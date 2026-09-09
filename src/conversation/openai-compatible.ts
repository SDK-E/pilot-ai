import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { GenerateConversationReply } from "./command.js";
import { conversationRuntimeConfig } from "./config.js";
import type { createPilotConversationRuntime } from "./pilot-conversation.js";

const chatMessageSchema = z
  .object({
    role: z.enum(["system", "developer", "user"]),
    content: z.string().min(1).max(20_000),
  })
  .strict();

export const chatCompletionRequestSchema = z
  .object({
    model: z.literal(conversationRuntimeConfig.modelId),
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
    baseAgentId: z.enum(["conversational", "research"]),
    allowedToolIds: z.array(z.literal("web-search")).max(1),
    toolApprovalMode: z.enum(["allow", "ask"]).optional(),
    projectId: z.uuid().optional(),
    projectInstructions: z.string().min(1).max(10_000).optional(),
    projectSharedMemoryEnabled: z.boolean().optional(),
  })
  .strict();

function parseAllowedToolIds(value: string | null): unknown {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseToolApprovalMode(value: string | null): unknown {
  return value === "allow" || value === "ask" ? value : undefined;
}

function parseOptionalBoolean(value: string | null): unknown {
  if (value === null) return undefined;
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
    allowedToolIds: parseAllowedToolIds(
      headers.get("x-pilot-allowed-tool-ids"),
    ),
    toolApprovalMode: parseToolApprovalMode(
      headers.get("x-pilot-tool-approval-mode"),
    ),
    projectId: headers.get("x-pilot-project-id") || undefined,
    projectInstructions:
      headers.get("x-pilot-project-instructions") || undefined,
    projectSharedMemoryEnabled: parseOptionalBoolean(
      headers.get("x-pilot-project-shared-memory-enabled"),
    ),
  });
  const message = request.messages.at(-1);
  const instructions = request.messages.find(
    (item) => item.role === "system" || item.role === "developer",
  );

  if (!message || message.role !== "user" || !instructions) {
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
    toolApprovalMode: context.toolApprovalMode,
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
}) {
  return {
    object: "pilot.approval.required" as const,
    run_id: result.runId,
    tool_call_id: result.toolCallId,
  };
}

export function createChatCompletionResponse(
  result: Awaited<
    ReturnType<ReturnType<typeof createPilotConversationRuntime>["generate"]>
  >,
) {
  return {
    id: `chatcmpl_${result.runId ?? randomUUID()}`,
    object: "chat.completion" as const,
    created: Math.floor(Date.now() / 1_000),
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
    usage: {
      prompt_tokens: result.usage.inputTokens,
      completion_tokens: result.usage.outputTokens,
      total_tokens: result.usage.totalTokens,
    },
  };
}

type StreamingConversationResult = {
  runId: string | null;
  textStream: AsyncIterable<string>;
  result(): Promise<
    | {
        kind: "completed";
        finishReason: string | undefined;
        modelId: string;
        runId: string | null;
        usage: {
          inputTokens: number;
          outputTokens: number;
          totalTokens: number;
        };
      }
    | {
        kind: "suspended";
        runId: string;
        toolCallId: string;
        usage: {
          inputTokens: number;
          outputTokens: number;
          totalTokens: number;
        };
      }
  >;
};

export function isStreamingChatCompletionRequest(rawRequest: unknown) {
  return chatCompletionRequestSchema.parse(rawRequest).stream === true;
}

export function createChatCompletionStream(
  result: StreamingConversationResult,
  options: { includeUsage: boolean; onClose: () => Promise<void> },
) {
  const encoder = new TextEncoder();
  const id = `chatcmpl_${result.runId ?? randomUUID()}`;
  const created = Math.floor(Date.now() / 1_000);

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
              model: "kilo/kilo-auto/free",
              choices: [
                {
                  index: 0,
                  delta: { content: text },
                  finish_reason: null,
                },
              ],
            }),
          );
        }

        const completed = await result.result();
        if (completed.kind === "suspended") {
          controller.enqueue(
            send({
              id,
              object: "pilot.approval.required",
              model: "kilo/kilo-auto/free",
              pilot: {
                run_id: completed.runId,
                tool_call_id: completed.toolCallId,
              },
            }),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        controller.enqueue(
          send({
            id,
            object: "chat.completion.chunk",
            created,
            model: completed.modelId,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason:
                  completed.finishReason === "stop" ? "stop" : "length",
              },
            ],
          }),
        );
        if (options.includeUsage) {
          controller.enqueue(
            send({
              id,
              object: "chat.completion.chunk",
              created,
              model: completed.modelId,
              choices: [],
              usage: {
                prompt_tokens: completed.usage.inputTokens,
                completion_tokens: completed.usage.outputTokens,
                total_tokens: completed.usage.totalTokens,
              },
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
