import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  ALLOWED_TOOL_IDS,
  baseAgentIdSchema,
  type GenerateConversationReply,
} from "../../contracts/conversation.js";

import type { CompletedResult } from "../agents/runtime/results.js";

const chatMessageSchema = z
  .object({
    role: z.enum(["system", "developer", "user"]),
    content: z.string().min(1).max(20_000),
  })
  .strict();

export const chatCompletionRequestSchema = z
  .object({
    model: z
      .string()
      .regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:/-]*$/i)
      .max(200),
    messages: z.array(chatMessageSchema).min(1).max(2),
    stream: z.boolean().optional(),
    stream_options: z
      .object({ include_usage: z.literal(true).optional() })
      .strict()
      .optional(),
  })
  .strict();

const pilotContextSchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    workerId: z.uuid(),
    conversationId: z.uuid(),
    executionId: z.uuid(),
    baseAgentId: baseAgentIdSchema,
    allowedToolIds: z
      .array(z.enum(ALLOWED_TOOL_IDS))
      .max(ALLOWED_TOOL_IDS.length),
    projectId: z.uuid().optional(),
    projectInstructions: z.string().min(1).max(10_000).optional(),
    projectSharedMemoryEnabled: z.boolean().optional(),
  })
  .strict();

/**
An absent or empty header means "not provided".
*/
function optionalHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name);
  return value === null || value === "" ? undefined : value;
}

function jsonHeader(headers: Headers, name: string): unknown {
  const value = optionalHeader(headers, name);
  if (value === undefined) return [];
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function booleanHeader(headers: Headers, name: string): unknown {
  const value = optionalHeader(headers, name);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function gatewayHeaders(headers: Headers) {
  const gatewayApiKey = optionalHeader(
    headers,
    "x-pilot-model-gateway-api-key",
  );
  const gatewayBaseUrl = optionalHeader(
    headers,
    "x-pilot-model-gateway-base-url",
  );
  return {
    ...(gatewayApiKey && { gatewayApiKey }),
    ...(gatewayBaseUrl && { gatewayBaseUrl }),
  };
}

export function createConversationCommandFromChatCompletion(
  rawRequest: unknown,
  headers: Headers,
): GenerateConversationReply {
  const request = chatCompletionRequestSchema.parse(rawRequest);
  const context = pilotContextSchema.parse({
    organizationId: headers.get("x-pilot-organization-id"),
    workerId: headers.get("x-pilot-worker-id"),
    conversationId: headers.get("x-pilot-conversation-id"),
    executionId: headers.get("x-pilot-execution-id"),
    baseAgentId: headers.get("x-pilot-base-agent-id"),
    allowedToolIds: jsonHeader(headers, "x-pilot-allowed-tool-ids"),
    projectId: optionalHeader(headers, "x-pilot-project-id"),
    projectInstructions: optionalHeader(
      headers,
      "x-pilot-project-instructions",
    ),
    projectSharedMemoryEnabled: booleanHeader(
      headers,
      "x-pilot-project-shared-memory-enabled",
    ),
  });
  const message = request.messages.at(-1);
  const instructions = request.messages.find(
    (item) => item.role === "system" || item.role === "developer",
  );

  if (!instructions || message?.role !== "user") {
    throw new Error(
      "A system or developer instruction and a final user message are required.",
    );
  }

  return {
    organizationId: context.organizationId,
    worker: {
      id: context.workerId,
      instructions: instructions.content,
      modelId: request.model,
      ...gatewayHeaders(headers),
    },
    conversationId: context.conversationId,
    message: message.content,
    executionId: context.executionId,
    baseAgentId: context.baseAgentId,
    allowedToolIds: context.allowedToolIds,
    project: context.projectId
      ? {
          id: context.projectId,
          instructions: context.projectInstructions,
          sharedMemoryEnabled: context.projectSharedMemoryEnabled ?? false,
        }
      : undefined,
  };
}

export function createUserInputRequiredResponse(result: {
  runId: string;
  toolCallId: string;
  question: string;
  options?: { label: string; description?: string }[];
  selectionMode?: "single_select" | "multi_select";
}) {
  return {
    object: "pilot.user_input.required" as const,
    run_id: result.runId,
    tool_call_id: result.toolCallId,
    question: result.question,
    options: result.options,
    selection_mode: result.selectionMode,
  };
}

function openAiUsage(usage: CompletedResult["usage"]) {
  return {
    prompt_tokens: usage.inputTokens,
    completion_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
  };
}

export function createChatCompletionResponse(result: CompletedResult) {
  return {
    id: `chatcmpl_${result.runId ?? randomUUID()}`,
    object: "chat.completion" as const,
    created: Math.floor(Date.now() / 1000),
    model: result.modelId,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as const,
          content: result.text,
          refusal: null,
        },
        finish_reason: result.finishReason === "stop" ? "stop" : "length",
      },
    ],
    usage: openAiUsage(result.usage),
  };
}

export function isStreamingChatCompletionRequest(rawRequest: unknown) {
  return chatCompletionRequestSchema.parse(rawRequest).stream === true;
}

export { createChatCompletionStream } from "./chat-completion-stream.js";
