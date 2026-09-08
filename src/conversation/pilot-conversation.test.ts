import { describe, expect, it } from "vitest";

import { generateConversationReplySchema } from "./pilot-conversation";

import {
  createConversationResourceId,
  createMemoryResourceId,
  createProjectResourceId,
} from "./command";

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
  baseAgentId: "conversational" as const,
  allowedToolIds: [] as "web-search"[],
  executionId: "98f1871e-72fb-4c5c-9a09-d89713e64950",
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

  it("uses a project resource only when shared project memory is enabled", () => {
    const project = {
      id: "46cc2779-64a8-467a-851c-2448c550cd7e",
      sharedMemoryEnabled: true,
    };
    expect(createMemoryResourceId({ ...validCommand, project })).toBe(
      createProjectResourceId(
        validCommand.organizationId,
        validCommand.worker.id,
        project.id,
      ),
    );
    expect(
      createMemoryResourceId({
        ...validCommand,
        project: { ...project, sharedMemoryEnabled: false },
      }),
    ).toBe(
      createConversationResourceId(
        validCommand.organizationId,
        validCommand.worker.id,
      ),
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
