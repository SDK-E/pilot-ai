import { z } from "zod";

import {
  createMemoryResourceId,
  type GenerateConversationReply,
} from "../../../contracts/conversation.js";

import type { Agent } from "@mastra/core/agent";

export interface SuspendedOutput {
  finishReason: "suspended";
  runId: string;
  suspendPayload: { toolCallId: string };
}

export function isSuspended(value: {
  finishReason: string | undefined;
  runId?: string;
  suspendPayload: unknown;
}): value is SuspendedOutput {
  return (
    value.finishReason === "suspended" &&
    typeof value.runId === "string" &&
    typeof (value.suspendPayload as { toolCallId?: unknown } | undefined)
      ?.toolCallId === "string"
  );
}

async function suspendedToolCall(
  agent: Agent,
  command: GenerateConversationReply,
  runId: string,
  toolCallId: string,
) {
  const runs = await agent.listSuspendedRuns({
    threadId: command.conversationId,
    resourceId: createMemoryResourceId(command),
  });
  return runs.runs
    .find((candidate) => candidate.runId === runId)
    ?.toolCalls.find((tool) => tool.toolCallId === toolCallId);
}

export const askUserPayloadSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    options: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(120),
          description: z.string().trim().min(1).max(300).optional(),
        }),
      )
      .min(2)
      .max(8)
      .optional(),
    selectionMode: z.enum(["single_select", "multi_select"]).optional(),
  })
  .strict();

export async function suspendedAskUserInput(
  agent: Agent,
  command: GenerateConversationReply,
  runId: string,
  toolCallId: string,
) {
  const tool = await suspendedToolCall(agent, command, runId, toolCallId);
  if (tool?.toolName !== "ask_user" || tool.requiresApproval) {
    throw new Error("The suspended tool is not an Ask User request.");
  }
  return askUserPayloadSchema.parse(tool.suspendPayload);
}
