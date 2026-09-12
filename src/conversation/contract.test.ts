import { describe, expect, it } from "vitest";

import {
  generateConversationReplySchema,
  type GenerateConversationReply,
  createConversationResourceId,
  createProjectResourceId,
  createMemoryResourceId,
  PILOT_CONVERSATION_MODEL_ID,
  ALLOWED_TOOL_IDS,
  BASE_AGENT_IDS,
} from "./contract";

const validCommand: GenerateConversationReply = {
  organizationId: "org_01J4QY5F74J9SE3MQS7K0WB2N9",
  worker: {
    id: "e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0",
    instructions: "Be concise and helpful.",
    modelId: PILOT_CONVERSATION_MODEL_ID,
  },
  conversationId: "97e756d5-2c8c-47fa-8a87-0e8dcddb7d28",
  message: "Hello.",
  baseAgentId: "conversational",
  allowedToolIds: [],
  executionId: "98f1871e-72fb-4c5c-9a09-d89713e64950",
};

describe("contract", () => {
  it("PILOT_CONVERSATION_MODEL_ID is the allowlisted dev model", () => {
    expect(PILOT_CONVERSATION_MODEL_ID).toBe("kilo/kilo-auto/free");
  });

  it("ALLOWED_TOOL_IDS matches production tool set", () => {
    expect(ALLOWED_TOOL_IDS).toEqual(["web-search", "scratchpad", "ask-user"]);
  });

  it("BASE_AGENT_IDS matches cataloguer bases", () => {
    expect(BASE_AGENT_IDS).toEqual(["conversational", "research"]);
  });

  it("parses a valid GenerateConversationReply", () => {
    const result = generateConversationReplySchema.safeParse(validCommand);
    expect(result.success).toBe(true);
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

  it("rejects toolApprovalMode without allowed tools", () => {
    const result = generateConversationReplySchema.safeParse({
      ...validCommand,
      toolApprovalMode: "ask",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the full production shared-tool set", () => {
    const result = generateConversationReplySchema.safeParse({
      ...validCommand,
      allowedToolIds: ["web-search", "scratchpad", "ask-user"],
      toolApprovalMode: "ask",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowedToolIds).toEqual([
        "web-search",
        "scratchpad",
        "ask-user",
      ]);
      expect(result.data.toolApprovalMode).toBe("ask");
    }
  });

  it("createConversationResourceId scopes by organization + worker", () => {
    expect(
      createConversationResourceId(validCommand.organizationId, validCommand.worker.id),
    ).toBe("pilot-conversation:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0");
  });

  it("createProjectResourceId includes project", () => {
    expect(
      createProjectResourceId(
        validCommand.organizationId,
        validCommand.worker.id,
        "proj_1",
      ),
    ).toBe("pilot-project:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0:proj_1");
  });

  it("createMemoryResourceId uses project resource only when shared memory enabled", () => {
    expect(
      createMemoryResourceId({ ...validCommand, project: { id: "p1", sharedMemoryEnabled: true } }),
    ).toBe(
      "pilot-project:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0:p1",
    );
    expect(
      createMemoryResourceId({ ...validCommand, project: { id: "p1", sharedMemoryEnabled: false } }),
    ).toBe(
      "pilot-conversation:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0",
    );
  });

  it("import graph: contract.ts does not import @mastra/* or process.env", () => {
    // Self-documenting: contract.ts is pure — imports only "zod".
    // This test asserts the contract is a DTO consumer without
    // @mastra/* or process.env dependencies.
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "contract.ts"),
      "utf-8",
    );
    expect(source).not.toContain("@mastra");
    expect(source).not.toContain("process.env");
  });
});
