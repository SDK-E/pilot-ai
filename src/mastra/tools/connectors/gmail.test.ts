import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConnectorGmailTool } from "./gmail.js";

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

function requireExecute<T extends { execute?: unknown }>(
  tool: T,
): NonNullable<T["execute"]> {
  if (!tool.execute) {
    throw new Error("Tool has no execute function.");
  }
  return tool.execute;
}

describe("connector-gmail tool", () => {
  it("renders a message list", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        result: {
          items: [
            {
              id: "m1",
              subject: "Hello",
              from: "a@example.com",
              snippet: "Hi there",
            },
          ],
        },
      }),
    );

    const tool = createConnectorGmailTool({ command, runtimeToken: "t" });
    const output = await requireExecute(tool)(
      { action: "search-messages", query: "hello", limit: 10 } as never,
      {} as never,
    );

    expect(output).toEqual({
      items: [
        {
          id: "m1",
          subject: "Hello",
          from: "a@example.com",
          snippet: "Hi there",
        },
      ],
    });
  });

  it("rejects a response with neither items nor message instead of silently reporting empty", async () => {
    fetchMock.mockResolvedValue(Response.json({ result: {} }));

    const tool = createConnectorGmailTool({ command, runtimeToken: "t" });

    await expect(
      requireExecute(tool)(
        { action: "read-message", messageId: "m1" } as never,
        {} as never,
      ),
    ).rejects.toThrow(/missing both items and message/);
  });
});
