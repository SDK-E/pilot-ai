import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { GenerateConversationReply } from './command.js';
import { conversationRuntimeConfig } from './config.js';
import type { createPilotConversationRuntime } from './pilot-conversation.js';

const chatMessageSchema = z.object({
  role: z.enum(['system', 'developer', 'user']),
  content: z.string().min(1).max(20_000),
}).strict();

export const chatCompletionRequestSchema = z.object({
  model: z.literal(conversationRuntimeConfig.modelId),
  messages: z.array(chatMessageSchema).min(1).max(2),
  stream: z.boolean().optional(),
  stream_options: z
    .object({ include_usage: z.literal(true).optional() })
    .strict()
    .optional(),
}).strict();

const pilotContextSchema = z.object({
  organizationId: z.string().min(1).max(255),
  workerId: z.uuid(),
  conversationId: z.uuid(),
}).strict();

export function createConversationCommandFromChatCompletion(
  rawRequest: unknown,
  headers: Headers,
): GenerateConversationReply {
  const request = chatCompletionRequestSchema.parse(rawRequest);
  const context = pilotContextSchema.parse({
    organizationId: headers.get('x-pilot-organization-id'),
    workerId: headers.get('x-pilot-worker-id'),
    conversationId: headers.get('x-pilot-conversation-id'),
  });
  const message = request.messages.at(-1);
  const instructions = request.messages.find(
    (item) => item.role === 'system' || item.role === 'developer',
  );

  if (!message || message.role !== 'user' || !instructions) {
    throw new Error(
      'A system or developer instruction and a final user message are required.',
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
    allowedToolIds: [],
  };
}

export function createChatCompletionResponse(
  result: Awaited<
    ReturnType<ReturnType<typeof createPilotConversationRuntime>['generate']>
  >,
) {
  return {
    id: `chatcmpl_${result.runId ?? randomUUID()}`,
    object: 'chat.completion' as const,
    created: Math.floor(Date.now() / 1_000),
    model: result.modelId,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant' as const,
          content: result.text,
          refusal: null,
        },
        finish_reason: result.finishReason === 'stop' ? 'stop' : 'length',
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
  result(): Promise<{
    finishReason: string | undefined;
    modelId: string;
    runId: string | null;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }>;
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
              object: 'chat.completion.chunk',
              created,
              model: 'kilo/kilo-auto/free',
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
        controller.enqueue(
          send({
            id,
            object: 'chat.completion.chunk',
            created,
            model: completed.modelId,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason:
                  completed.finishReason === 'stop' ? 'stop' : 'length',
              },
            ],
          }),
        );
        if (options.includeUsage) {
          controller.enqueue(
            send({
              id,
              object: 'chat.completion.chunk',
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
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        await options.onClose();
      }
    },
  });
}
