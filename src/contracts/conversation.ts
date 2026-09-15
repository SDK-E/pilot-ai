import { z } from "zod";

export const PILOT_CONVERSATION_MODEL_ID = "kilo/kilo-auto/free" as const;

export const ALLOWED_TOOL_IDS = [
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
] as const;

export type AllowedToolId = (typeof ALLOWED_TOOL_IDS)[number];

/**
The agent kinds. Every kind is built from the base agent.
*/
export const BASE_AGENT_IDS = ["chat", "work", "code"] as const;

export type BaseAgentId = (typeof BASE_AGENT_IDS)[number];

/**
Ids Pilot sent before the kinds existed. Accepted until Pilot migrates.
*/
export const LEGACY_BASE_AGENT_IDS = new Map<string, BaseAgentId>([
  ["conversational", "chat"],
  ["research", "chat"],
]);

export function normalizeBaseAgentId(value: unknown): unknown {
  return typeof value === "string"
    ? (LEGACY_BASE_AGENT_IDS.get(value) ?? value)
    : value;
}

export const baseAgentIdSchema = z.preprocess(
  normalizeBaseAgentId,
  z.enum(BASE_AGENT_IDS),
);

export const generateConversationReplySchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    worker: z.object({
      id: z.uuid(),
      instructions: z.string().min(1).max(20_000),
      modelId: z
        .string()
        .regex(/^kilo\/[a-z0-9][a-z0-9._:-]*(?:\/[a-z0-9][a-z0-9._:-]*)*$/i)
        .max(200),
    }),
    conversationId: z.uuid(),
    message: z.string().min(1).max(10_000),
    baseAgentId: baseAgentIdSchema,
    // 20 is generous headroom above ALLOWED_TOOL_IDS's current length, not a
    // cap tied to the number of tools that exist today.
    allowedToolIds: z.array(z.enum(ALLOWED_TOOL_IDS)).max(20).default([]),
    executionId: z.uuid(),
    project: z
      .object({
        id: z.uuid(),
        instructions: z.string().min(1).max(10_000).optional(),
        sharedMemoryEnabled: z.boolean(),
      })
      .optional(),
  })
  .strict();

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
