import { describe, expect, it } from "vitest";

import conversationDelete from "../../../api/v1/conversations/delete.js";
import projectMemoryDelete from "../../../api/v1/projects/delete-memory.js";

describe("Vercel cleanup entrypoints", () => {
  it("loads the conversation cleanup function and rejects non-POST requests", async () => {
    const response = await conversationDelete.fetch(
      new Request("https://ai.pilot.test/v1/conversations/delete"),
    );
    expect(response.status).toBe(405);
  });

  it("loads the project cleanup function and rejects non-POST requests", async () => {
    const response = await projectMemoryDelete.fetch(
      new Request("https://ai.pilot.test/v1/projects/delete-memory"),
    );
    expect(response.status).toBe(405);
  });
});

describe("Vercel approval resume entrypoint", () => {
  it("loads and rejects a non-POST request before parsing an approval command", async () => {
    const approvalResume = await import("../../../api/v1/approvals/resume.js");
    const response = await approvalResume.default.fetch(
      new Request("https://ai.pilot.test/v1/approvals/resume"),
    );
    expect(response.status).toBe(405);
  });
});
