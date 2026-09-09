import { z } from "zod";

import { conversationRuntimeConfig } from "./config.js";

const resourcePrefix = "pilot-conversation";
const projectResourcePrefix = "pilot-project";

export const generateConversationReplySchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    worker: z.object({
      id: z.uuid(),
      instructions: z.string().min(1).max(20_000),
      modelId: z.literal(conversationRuntimeConfig.modelId),
    }),
    conversationId: z.uuid(),
    message: z.string().min(1).max(10_000),
    baseAgentId: z.enum(["conversational", "research"]),
    allowedToolIds: z.array(z.literal("web-search")).max(1).default([]),
    toolApprovalMode: z.enum(["allow", "ask"]).optional(),
    executionId: z.uuid(),
    project: z
      .object({
        id: z.uuid(),
        instructions: z.string().min(1).max(10_000).optional(),
        sharedMemoryEnabled: z.boolean(),
      })
      .optional(),
  })
  .strict()
  .superRefine((command, context) => {
    if (command.toolApprovalMode && command.allowedToolIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A tool approval mode requires an allowed tool.",
        path: ["toolApprovalMode"],
      });
    }
    if (
      command.baseAgentId === "conversational" &&
      command.allowedToolIds.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Conversational requests cannot use tools.",
        path: ["allowedToolIds"],
      });
    }
  });

export type GenerateConversationReply = z.infer<
  typeof generateConversationReplySchema
>;

export function createConversationResourceId(
  organizationId: string,
  workerId: string,
): string {
  return [resourcePrefix, organizationId, workerId].join(":");
}

export function createProjectResourceId(
  organizationId: string,
  workerId: string,
  projectId: string,
): string {
  return [projectResourcePrefix, organizationId, workerId, projectId].join(":");
}

export function createMemoryResourceId(
  command: GenerateConversationReply,
): string {
  if (command.project?.sharedMemoryEnabled) {
    return createProjectResourceId(
      command.organizationId,
      command.worker.id,
      command.project.id,
    );
  }
  return createConversationResourceId(
    command.organizationId,
    command.worker.id,
  );
}
