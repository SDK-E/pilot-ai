import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callConnector, connectorsExecuteUrl } from "./callback.js";

import type { GenerateConversationReply } from "../../../contracts/conversation.js";

const fetchMock = vi.fn();

const command = {
  organizationId: "org_1",
  executionId: "11111111-1111-1111-1111-111111111111",
} as GenerateConversationReply;

beforeEach(() => {
  vi.stubEnv("PILOT_ACTIVITY_CALLBACK_URL", "https://pilot.example.com");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("connectorsExecuteUrl", () => {
  it("points at the runtime connectors execute callback on the configured origin", () => {
    expect(connectorsExecuteUrl().toString()).toBe(
      "https://pilot.example.com/api/runtime/connectors/execute",
    );
  });
});

describe("callConnector", () => {
  it("posts the envelope and returns the result field on success", async () => {
    fetchMock.mockResolvedValue(Response.json({ result: { items: [] } }));

    const result = await callConnector({
      context: { command, runtimeToken: "token-1" },
      callbackUrl: connectorsExecuteUrl(),
      toolId: "connector",
      toolLabel: "GitHub",
      action: "search-issues",
      params: { query: "bug" },
    });

    expect(result).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://pilot.example.com/api/runtime/connectors/execute",
    );
    expect(init.headers).toMatchObject({
      "x-pilot-runtime-token": "token-1",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      organizationId: "org_1",
      executionId: "11111111-1111-1111-1111-111111111111",
      toolId: "connector",
      action: "search-issues",
      params: { query: "bug" },
    });
  });

  it("includes confirm in the envelope only when explicitly set", async () => {
    fetchMock.mockResolvedValue(Response.json({ result: { item: null } }));

    await callConnector({
      context: { command, runtimeToken: "token-1" },
      callbackUrl: connectorsExecuteUrl(),
      toolId: "connector",
      toolLabel: "Connector",
      action: "post-message",
      params: { text: "hi" },
      connectorSlug: "slack",
      confirm: true,
    });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ confirm: true });
  });

  it("throws the server-provided error message on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "No connected account." }, { status: 404 }),
    );

    await expect(
      callConnector({
        context: { command, runtimeToken: "token-1" },
        callbackUrl: connectorsExecuteUrl(),
        toolId: "connector",
        toolLabel: "GitHub",
        action: "search-issues",
        params: {},
      }),
    ).rejects.toThrow("No connected account.");
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>502</html>", { status: 502 }),
    );

    await expect(
      callConnector({
        context: { command, runtimeToken: "token-1" },
        callbackUrl: connectorsExecuteUrl(),
        toolId: "connector",
        toolLabel: "GitHub",
        action: "search-issues",
        params: {},
      }),
    ).rejects.toThrow("GitHub connector callback returned 502.");
  });
});
