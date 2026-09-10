import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const generate = vi.fn();
  const stream = vi.fn();
  const close = vi.fn();
  const verifyRequest = vi.fn();

  return {
    generate,
    close,
    verifyRequest,
    stream,
    createRuntime: vi.fn(() => ({ generate, stream, close })),
    createToolRuntime: vi.fn(() => ({ generate, stream, close })),
  };
});

vi.mock("./pilot-conversation.js", () => ({
  createPilotConversationRuntime: mocks.createRuntime,
}));

vi.mock("../research/pilot-research.js", () => ({
  createPilotProductionToolRuntime: mocks.createToolRuntime,
}));

vi.mock("../runtime/auth/vercel-oidc.js", () => ({
  verifyPilotRuntimeRequest: mocks.verifyRequest,
}));

import handler from "../../api/v1/chat/completions";

const headers = {
  "content-type": "application/json",
  "x-pilot-organization-id": "org-preview",
  "x-pilot-worker-id": "6f96e48d-c27a-4b4b-ab63-e406f69132ce",
  "x-pilot-conversation-id": "2e61a6d9-0b48-4e17-8e0e-97075112953d",
  "x-pilot-execution-id": "843b97b3-b0ec-4244-9a6c-2b872645a9ed",
  "x-pilot-base-agent-id": "conversational",
  "x-pilot-allowed-tool-ids": "[]",
};

describe("OpenAI-compatible Pilot Conversation function", () => {
  beforeEach(() => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://runtime.turso.io");
    vi.stubEnv("TURSO_AUTH_TOKEN", "runtime-token");
    mocks.generate.mockReset();
    mocks.stream.mockReset();
    mocks.close.mockReset();
    mocks.createRuntime.mockClear();
    mocks.createToolRuntime.mockClear();
    mocks.verifyRequest.mockReset();
    mocks.verifyRequest.mockResolvedValue(true);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns an OpenAI chat completion for a verified Pilot request", async () => {
    mocks.generate.mockResolvedValue({
      text: "Hello.",
      finishReason: "stop",
      modelId: "kilo/kilo-auto/free",
      runId: "run-123",
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });

    const response = await handler.fetch(
      new Request("https://ai.pilot.test/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "kilo/kilo-auto/free",
          messages: [
            { role: "system", content: "Be helpful." },
            { role: "user", content: "Hello." },
          ],
          stream: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "chatcmpl_run-123",
      object: "chat.completion",
      model: "kilo/kilo-auto/free",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hello.", refusal: null },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    });
    expect(mocks.generate).toHaveBeenCalledWith({
      organizationId: "org-preview",
      worker: {
        id: "6f96e48d-c27a-4b4b-ab63-e406f69132ce",
        instructions: "Be helpful.",
        modelId: "kilo/kilo-auto/free",
      },
      conversationId: "2e61a6d9-0b48-4e17-8e0e-97075112953d",
      message: "Hello.",
      baseAgentId: "conversational",
      allowedToolIds: [],
      executionId: "843b97b3-b0ec-4244-9a6c-2b872645a9ed",
    });
  });

  it("accepts server-provided project context without trusting the request body", async () => {
    mocks.generate.mockResolvedValue({
      text: "Hello.",
      finishReason: "stop",
      modelId: "kilo/kilo-auto/free",
      runId: "run-project",
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });
    const response = await handler.fetch(
      new Request("https://ai.pilot.test/v1/chat/completions", {
        method: "POST",
        headers: {
          ...headers,
          "x-pilot-project-id": "46cc2779-64a8-467a-851c-2448c550cd7e",
          "x-pilot-project-instructions": "Use the project plan.",
          "x-pilot-project-shared-memory-enabled": "true",
        },
        body: JSON.stringify({
          model: "kilo/kilo-auto/free",
          messages: [
            { role: "system", content: "Be helpful." },
            { role: "user", content: "Hello." },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        project: {
          id: "46cc2779-64a8-467a-851c-2448c550cd7e",
          instructions: "Use the project plan.",
          sharedMemoryEnabled: true,
        },
      }),
    );
  });

  it("rejects requests without a valid Vercel OIDC token before initialization", async () => {
    mocks.verifyRequest.mockResolvedValue(false);

    const response = await handler.fetch(
      new Request("https://ai.pilot.test/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "kilo/kilo-auto/free",
          messages: [{ role: "user", content: "Hello." }],
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Unauthorized.", type: "authentication_error" },
    });
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it("rejects public web search before the production adapter is enabled", async () => {
    const response = await handler.fetch(
      new Request("https://ai.pilot.test/v1/chat/completions", {
        method: "POST",
        headers: {
          ...headers,
          "x-pilot-base-agent-id": "conversational",
          "x-pilot-allowed-tool-ids": '["web-search"]',
        },
        body: JSON.stringify({
          model: "kilo/kilo-auto/free",
          messages: [
            { role: "system", content: "Use primary sources." },
            { role: "user", content: "Find current sources." },
          ],
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Pilot public web search is not enabled.",
        type: "invalid_request_error",
      },
    });
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it("accepts the private scratchpad capability without enabling public research", async () => {
    mocks.generate.mockResolvedValue({
      text: "Saved.",
      finishReason: "stop",
      modelId: "kilo/kilo-auto/free",
      runId: "scratchpad-123",
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });
    const response = await handler.fetch(
      new Request("https://ai.pilot.test/v1/chat/completions", {
        method: "POST",
        headers: {
          ...headers,
          "x-pilot-allowed-tool-ids": '["scratchpad"]',
          "x-pilot-runtime-oidc-token": "pilot-oidc-token",
        },
        body: JSON.stringify({
          model: "kilo/kilo-auto/free",
          messages: [
            { role: "system", content: "Be helpful." },
            { role: "user", content: "Keep concise notes." },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createToolRuntime).toHaveBeenCalledOnce();
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it("streams OpenAI-compatible chunks for a verified Pilot request", async () => {
    mocks.stream.mockResolvedValue({
      runId: "stream-123",
      textStream: new ReadableStream({
        start(controller) {
          controller.enqueue("Hello");
          controller.enqueue(".");
          controller.close();
        },
      }),
      result: vi.fn().mockResolvedValue({
        finishReason: "stop",
        modelId: "kilo/kilo-auto/free",
        runId: "stream-123",
        usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      }),
    });

    const response = await handler.fetch(
      new Request("https://ai.pilot.test/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "kilo/kilo-auto/free",
          messages: [
            { role: "system", content: "Be helpful." },
            { role: "user", content: "Hello." },
          ],
          stream: true,
          stream_options: { include_usage: true },
        }),
      }),
    );

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await expect(response.text()).resolves.toContain("data: [DONE]");
    expect(mocks.stream).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
