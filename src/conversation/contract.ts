import { z } from "zod";

export const PILOT_CONVERSATION_MODEL_ID = "kilo/kilo-auto/free" as const;

export const ALLOWED_TOOL_IDS = [
  "web-search",
  "scratchpad",
  "ask-user",
] as const;

export const BASE_AGENT_IDS = ["conversational", "research"] as const;

export const generateConversationReplySchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    worker: z.object({
      id: z.uuid(),
      instructions: z.string().min(1).max(20_000),
      modelId: z.literal(PILOT_CONVERSATION_MODEL_ID),
    }),
    conversationId: z.uuid(),
    message: z.string().min(1).max(10_000),
    baseAgentId: z.enum(BASE_AGENT_IDS),
    allowedToolIds: z.array(z.enum(ALLOWED_TOOL_IDS)).max(3).default([]),
    approvalRequiredToolIds: z
      .array(z.enum(ALLOWED_TOOL_IDS))
      .max(2)
      .default([]),
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
    for (const toolId of command.approvalRequiredToolIds) {
      if (!command.allowedToolIds.includes(toolId)) {
        context.addIssue({
          code: "custom",
          message: "An approval-required tool must be allowed.",
          path: ["approvalRequiredToolIds"],
        });
      }
      if (toolId === "ask-user") {
        context.addIssue({
          code: "custom",
          message:
            "Ask User is a clarification flow and cannot require approval.",
          path: ["approvalRequiredToolIds"],
        });
      }
    }
  });

export type GenerateConversationReply = z.infer<
  typeof generateConversationReplySchema
>;

const resourcePrefix = "pilot-conversation";
const projectResourcePrefix = "pilot-project";

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
