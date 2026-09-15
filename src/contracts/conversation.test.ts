import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ALLOWED_TOOL_IDS,
  BASE_AGENT_IDS,
  createConversationResourceId,
  createMemoryResourceId,
  createProjectResourceId,
  generateConversationReplySchema,
  PILOT_CONVERSATION_MODEL_ID,
  type GenerateConversationReply,
} from "./conversation.js";

const validCommand: GenerateConversationReply = {
  organizationId: "org_01J4QY5F74J9SE3MQS7K0WB2N9",
  worker: {
    id: "e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0",
    instructions: "Be concise and helpful.",
    modelId: PILOT_CONVERSATION_MODEL_ID,
  },
  conversationId: "97e756d5-2c8c-47fa-8a87-0e8dcddb7d28",
  message: "Hello.",
  baseAgentId: "chat",
  allowedToolIds: [],
  executionId: "98f1871e-72fb-4c5c-9a09-d89713e64950",
};

describe("contract", () => {
  it("PILOT_CONVERSATION_MODEL_ID is the allowlisted dev model", () => {
    expect(PILOT_CONVERSATION_MODEL_ID).toBe("kilo/kilo-auto/free");
  });

  it("ALLOWED_TOOL_IDS matches the production capability set", () => {
    expect(ALLOWED_TOOL_IDS).toEqual([
      "web-search",
      "scratchpad",
      "ask-user",
      "plan",
      "code-sandbox",
      "connector-github",
      "connector-google-drive",
      "connector-gmail",
      "connector-slack",
      "connector-notion",
      "connector-linear",
      "connector-vercel",
      "connector-monday",
    ]);
  });

  it("BASE_AGENT_IDS lists the three agent kinds", () => {
    expect(BASE_AGENT_IDS).toEqual(["chat", "work", "code"]);
  });

  it("parses a valid GenerateConversationReply", () => {
    const result = generateConversationReplySchema.safeParse(validCommand);
    expect(result.success).toBe(true);
  });

  it("maps the legacy base agent ids to chat", () => {
    for (const legacy of ["conversational", "research"]) {
      const result = generateConversationReplySchema.parse({
        ...validCommand,
        baseAgentId: legacy,
      });
      expect(result.baseAgentId).toBe("chat");
    }
  });

  it("rejects an unknown base agent id", () => {
    const result = generateConversationReplySchema.safeParse({
      ...validCommand,
      baseAgentId: "browser",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unallowlisted model", () => {
    const result = generateConversationReplySchema.safeParse({
      ...validCommand,
      worker: { ...validCommand.worker, modelId: "openai/gpt-5" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unallowlisted tool", () => {
    const result = generateConversationReplySchema.safeParse({
      ...validCommand,
      allowedToolIds: ["stagehand-browser"],
    });
    expect(result.success).toBe(false);
  });

  it("createConversationResourceId scopes by organization + worker", () => {
    expect(
      createConversationResourceId(
        validCommand.organizationId,
        validCommand.worker.id,
      ),
    ).toBe(
      "pilot-conversation:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0",
    );
  });

  it("createProjectResourceId includes project", () => {
    expect(
      createProjectResourceId(
        validCommand.organizationId,
        validCommand.worker.id,
        "proj_1",
      ),
    ).toBe(
      "pilot-project:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0:proj_1",
    );
  });

  it("createMemoryResourceId uses project resource only when shared memory enabled", () => {
    expect(
      createMemoryResourceId({
        ...validCommand,
        project: { id: "p1", sharedMemoryEnabled: true },
      }),
    ).toBe(
      "pilot-project:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0:p1",
    );
    expect(
      createMemoryResourceId({
        ...validCommand,
        project: { id: "p1", sharedMemoryEnabled: false },
      }),
    ).toBe(
      "pilot-conversation:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0",
    );
  });

  it("stays pure: the contract imports neither @mastra/* nor process.env", () => {
    const source = readFileSync(
      new URL("conversation.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("@mastra");
    expect(source).not.toContain("process.env");
  });
});
