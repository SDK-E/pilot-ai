import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import handler from "../../../api/v1/chat/completions.js";

import { waitForStreamingResult } from "./openai-compatible.js";

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
  };
});

vi.mock("../agents/runtime/runtime.js", () => ({
  createPilotRuntime: mocks.createRuntime,
}));

vi.mock("../auth/vercel-oidc.js", () => ({
  verifyPilotRuntimeRequest: mocks.verifyRequest,
}));

const headers = {
  "content-type": "application/json",
  "x-pilot-organization-id": "org-preview",
  "x-pilot-worker-id": "6f96e48d-c27a-4b4b-ab63-e406f69132ce",
  "x-pilot-conversation-id": "2e61a6d9-0b48-4e17-8e0e-97075112953d",
  "x-pilot-execution-id": "843b97b3-b0ec-4244-9a6c-2b872645a9ed",
  "x-pilot-base-agent-id": "chat",
  "x-pilot-allowed-tool-ids": "[]",
};

const body = (extra: object = {}) =>
  JSON.stringify({
    model: "kilo/kilo-auto/free",
    messages: [
      { role: "system", content: "Be helpful." },
      { role: "user", content: "Hello." },
    ],
    ...extra,
  });

const completed = (runId: string) => ({
  kind: "completed",
  text: "Hello.",
  finishReason: "stop",
  modelId: "kilo/kilo-auto/free",
  runId,
  usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
});

const post = (init: { headers?: Record<string, string>; body?: string }) =>
  handler.fetch(
    new Request("https://ai.pilot.test/v1/chat/completions", {
      method: "POST",
      headers: { ...headers, ...init.headers },
      body: init.body ?? body(),
    }),
  );

describe("OpenAI-compatible chat completion function", () => {
  beforeEach(() => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://runtime.turso.io");
    vi.stubEnv("TURSO_AUTH_TOKEN", "runtime-token");
    mocks.generate.mockReset();
    mocks.stream.mockReset();
    mocks.close.mockReset();
    mocks.createRuntime.mockClear();
    mocks.verifyRequest.mockReset();
    mocks.verifyRequest.mockResolvedValue({ ok: true, reason: "ok" });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns an OpenAI chat completion for a verified Pilot request", async () => {
    mocks.generate.mockResolvedValue(completed("run-123"));

    const response = await post({ body: body({ stream: false }) });

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
      baseAgentId: "chat",
      allowedToolIds: [],
      approvalRequiredToolIds: [],
      executionId: "843b97b3-b0ec-4244-9a6c-2b872645a9ed",
      project: undefined,
    });
  });

  it("maps the legacy conversational base agent id to chat", async () => {
    mocks.generate.mockResolvedValue(completed("run-legacy"));

    const response = await post({
      headers: { "x-pilot-base-agent-id": "conversational" },
    });

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({ baseAgentId: "chat" }),
    );
  });

  it("accepts server-provided project context without trusting the request body", async () => {
    mocks.generate.mockResolvedValue(completed("run-project"));

    const response = await post({
      headers: {
        "x-pilot-project-id": "46cc2779-64a8-467a-851c-2448c550cd7e",
        "x-pilot-project-instructions": "Use the project plan.",
        "x-pilot-project-shared-memory-enabled": "true",
      },
    });

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

  it("passes the OIDC token to the runtime when capabilities are granted", async () => {
    mocks.generate.mockResolvedValue(completed("run-approval"));

    const response = await post({
      headers: {
        "x-pilot-allowed-tool-ids": '["scratchpad"]',
        "x-pilot-approval-required-tool-ids": '["scratchpad"]',
        "x-pilot-runtime-oidc-token": "runtime-token",
      },
    });

    expect(response.status).toBe(200);
    expect(mocks.createRuntime).toHaveBeenCalledWith(
      expect.anything(),
      "runtime-token",
    );
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedToolIds: ["scratchpad"],
        approvalRequiredToolIds: ["scratchpad"],
      }),
    );
  });

  it("rejects requests without a valid Vercel OIDC token before initialization", async () => {
    mocks.verifyRequest.mockResolvedValue({
      ok: false,
      reason: "no-token-header",
    });

    const response = await post({});

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Unauthorized: no-token-header",
        type: "authentication_error",
      },
    });
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it("rejects granted capabilities without a runtime OIDC token", async () => {
    const response = await post({
      headers: { "x-pilot-allowed-tool-ids": '["scratchpad"]' },
    });

    expect(response.status).toBe(401);
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it("rejects public web search before the production adapter is enabled", async () => {
    const response = await post({
      headers: { "x-pilot-allowed-tool-ids": '["web-search"]' },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Pilot public web search is not enabled.",
        type: "invalid_request_error",
      },
    });
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it("rejects the code sandbox before the production adapter is enabled", async () => {
    const response = await post({
      headers: { "x-pilot-allowed-tool-ids": '["code-sandbox"]' },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Pilot code sandbox is not enabled.",
        type: "invalid_request_error",
      },
    });
    expect(mocks.createRuntime).not.toHaveBeenCalled();
  });

  it("returns an Ask User suspension as a user-input-required object", async () => {
    mocks.generate.mockResolvedValue({
      kind: "user_input_required",
      runId: "ask-user-run",
      toolCallId: "ask-user-call",
      question: "Which audience should I prioritize?",
      options: [{ label: "Developers" }, { label: "Buyers" }],
      selectionMode: "single_select",
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });

    const response = await post({
      headers: {
        "x-pilot-allowed-tool-ids": '["ask-user"]',
        "x-pilot-runtime-oidc-token": "pilot-oidc-token",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "pilot.user_input.required",
      question: "Which audience should I prioritize?",
    });
  });

  it("streams OpenAI-compatible chunks for a verified Pilot request", async () => {
    mocks.stream.mockResolvedValue({
      runId: "stream-123",
      modelId: "kilo/kilo-auto/free",
      textStream: new ReadableStream({
        start(controller) {
          controller.enqueue("Hello");
          controller.enqueue(".");
          controller.close();
        },
      }),
      result: vi.fn().mockResolvedValue(completed("stream-123")),
    });

    const response = await post({
      body: body({ stream: true, stream_options: { include_usage: true } }),
    });

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const text = await response.text();
    expect(text).toContain('"model":"kilo/kilo-auto/free"');
    expect(text).toContain('"total_tokens":5');
    expect(text).toContain("data: [DONE]");
    expect(mocks.stream).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("releases the stream when its terminal runtime result does not arrive", async () => {
    vi.useFakeTimers();
    try {
      const never = new Promise<never>(() => {
        // never settles
      });
      const pending = waitForStreamingResult(never);
      const assertion = expect(pending).rejects.toThrow(
        "Pilot Conversation runtime did not complete in time.",
      );
      await vi.advanceTimersByTimeAsync(80_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
