import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  ALLOWED_TOOL_IDS,
  baseAgentIdSchema,
  type GenerateConversationReply,
} from "../../contracts/conversation.js";

import type { ApprovableCapabilityId } from "../agents/base/capabilities/index.js";
import type {
  CompletedResult,
  RuntimeResult,
} from "../agents/runtime/results.js";

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
      .regex(/^kilo\/[a-z0-9][a-z0-9._:-]*(?:\/[a-z0-9][a-z0-9._:-]*)*$/i)
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
    allowedToolIds: z.array(z.enum(ALLOWED_TOOL_IDS)).max(3),
    approvalRequiredToolIds: z
      .array(z.enum(ALLOWED_TOOL_IDS))
      .max(2)
      .default([]),
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
    approvalRequiredToolIds: jsonHeader(
      headers,
      "x-pilot-approval-required-tool-ids",
    ),
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

  if (message?.role !== "user" || !instructions) {
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
    },
    conversationId: context.conversationId,
    message: message.content,
    executionId: context.executionId,
    baseAgentId: context.baseAgentId,
    allowedToolIds: context.allowedToolIds,
    approvalRequiredToolIds: context.approvalRequiredToolIds,
    project: context.projectId
      ? {
          id: context.projectId,
          instructions: context.projectInstructions,
          sharedMemoryEnabled: context.projectSharedMemoryEnabled ?? false,
        }
      : undefined,
  };
}

export function createApprovalRequiredResponse(result: {
  runId: string;
  toolCallId: string;
  toolId: ApprovableCapabilityId;
}) {
  return {
    object: "pilot.approval.required" as const,
    run_id: result.runId,
    tool_call_id: result.toolCallId,
    tool_id: result.toolId,
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

export interface StreamingConversationResult {
  runId: string | null;
  modelId: string;
  textStream: AsyncIterable<string>;
  result(): Promise<RuntimeResult>;
}

// The deployed function has a 90-second ceiling. Leave enough time for Pilot
// to emit a structured error and release the runtime before Vercel terminates
// the request. A resolved result clears the timer immediately.
const STREAM_RESULT_TIMEOUT_MS = 80_000;

export function waitForStreamingResult<T>(result: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Pilot Conversation runtime did not complete in time."));
    }, STREAM_RESULT_TIMEOUT_MS);

    void result
      .then(resolve)
      .catch(reject)
      .finally(() => {
        clearTimeout(timer);
      });
  });
}

export function isStreamingChatCompletionRequest(rawRequest: unknown) {
  return chatCompletionRequestSchema.parse(rawRequest).stream === true;
}

function terminalEvent(
  id: string,
  model: string,
  completed: RuntimeResult,
): object {
  if (completed.kind === "suspended") {
    return {
      id,
      object: "pilot.approval.required",
      model,
      pilot: {
        run_id: completed.runId,
        tool_call_id: completed.toolCallId,
        tool_id: completed.toolId,
      },
    };
  }
  if (completed.kind === "user_input_required") {
    return {
      id,
      object: "pilot.user_input.required",
      model,
      pilot: {
        run_id: completed.runId,
        tool_call_id: completed.toolCallId,
        question: completed.question,
        options: completed.options,
        selection_mode: completed.selectionMode,
      },
    };
  }
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: completed.finishReason === "stop" ? "stop" : "length",
      },
    ],
  };
}

export function createChatCompletionStream(
  result: StreamingConversationResult,
  options: { includeUsage: boolean; onClose: () => Promise<void> },
) {
  const encoder = new TextEncoder();
  const id = `chatcmpl_${result.runId ?? randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = result.modelId;
  const send = (value: unknown) =>
    encoder.encode(`data: ${JSON.stringify(value)}\n\n`);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of result.textStream) {
          if (!text) continue;
          controller.enqueue(
            send({
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [
                { index: 0, delta: { content: text }, finish_reason: null },
              ],
            }),
          );
        }
        const completed = await waitForStreamingResult(result.result());
        controller.enqueue(send(terminalEvent(id, model, completed)));
        if (completed.kind === "completed" && options.includeUsage) {
          controller.enqueue(
            send({
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [],
              usage: openAiUsage(completed.usage),
            }),
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        await options.onClose();
      }
    },
  });
}
