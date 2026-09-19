import { describe, expect, it } from "vitest";

import {
  handleConversationCleanup,
  handleConversationTruncate,
  handleProjectMemoryCleanup,
} from "./cleanup.js";

describe("cleanup entrypoints", () => {
  it("loads the conversation cleanup function and rejects non-POST requests", async () => {
    const response = await handleConversationCleanup(
      new Request("https://ai.pilot.test/v1/conversations/delete"),
    );
    expect(response.status).toBe(405);
  });

  it("loads the conversation truncate function and rejects non-POST requests", async () => {
    const response = await handleConversationTruncate(
      new Request("https://ai.pilot.test/v1/conversations/truncate"),
    );
    expect(response.status).toBe(405);
  });

  it("loads the project cleanup function and rejects non-POST requests", async () => {
    const response = await handleProjectMemoryCleanup(
      new Request("https://ai.pilot.test/v1/projects/delete-memory"),
    );
    expect(response.status).toBe(405);
  });
});
