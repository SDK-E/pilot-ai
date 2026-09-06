import { describe, expect, it } from "vitest";

import {
  createConversationResourceId,
  generateConversationReplySchema,
} from "./pilot-conversation";

import { conversationRuntimeConfig } from "./config";

const validCommand = {
  organizationId: "org_01J4QY5F74J9SE3MQS7K0WB2N9",
  worker: {
    id: "e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0",
    instructions: "Be concise and helpful.",
    modelId: conversationRuntimeConfig.modelId,
  },
  conversationId: "97e756d5-2c8c-47fa-8a87-0e8dcddb7d28",
  message: "Hello.",
};

describe("Pilot Conversation command", () => {
  it("uses a stable resource for one organization and worker", () => {
    expect(
      createConversationResourceId(
        validCommand.organizationId,
        validCommand.worker.id,
      ),
    ).toBe(
      "pilot-conversation:org_01J4QY5F74J9SE3MQS7K0WB2N9:e7d8b5cb-164c-405e-8f74-53b5e7a2a7c0",
    );
  });

  it("rejects unapproved tool capabilities", () => {
    expect(() =>
      generateConversationReplySchema.parse({
        ...validCommand,
        allowedToolIds: ["stagehand-browser"],
      }),
    ).toThrow();
  });

  it("rejects an unallowlisted model", () => {
    expect(() =>
      generateConversationReplySchema.parse({
        ...validCommand,
        worker: {
          ...validCommand.worker,
          modelId: "openai/gpt-5",
        },
      }),
    ).toThrow();
  });
});
