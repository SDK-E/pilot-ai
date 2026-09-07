import { registerApiRoute } from '@mastra/core/server';
import { ZodError } from 'zod';

import {
  createChatCompletionResponse,
  createChatCompletionStream,
  createConversationCommandFromChatCompletion,
  isStreamingChatCompletionRequest,
} from '#conversation/openai-compatible';
import { createPilotConversationRuntime } from '../pilot-conversation.js';
import { createPilotResearchRuntime } from '#research/pilot-research';
import { verifyPilotRuntimeRequest } from '#runtime/auth/vercel-oidc';
import { getPilotRuntimeStorageConfig } from '#runtime/storage/pilot-runtime';

function error(message: string, type: string, status: number): Response {
  return Response.json({ error: { message, type } }, { status });
}

export const chatCompletionsRegistration = registerApiRoute(
  '/v1/chat/completions',
  {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) => {
      const request = c.req.raw;

      if (request.method !== 'POST') {
        return error('Method not allowed.', 'invalid_request_error', 405);
      }
      if (!(await verifyPilotRuntimeRequest(request))) {
        return error('Unauthorized.', 'authentication_error', 401);
      }

      const storageConfig = getPilotRuntimeStorageConfig();
      if (!storageConfig) {
        return error(
          'Pilot Conversation is not configured.',
          'server_error',
          503,
        );
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return error(
          'Request body must be valid JSON.',
          'invalid_request_error',
          400,
        );
      }

      let command;
      try {
        command = createConversationCommandFromChatCompletion(
          body,
          request.headers,
        );
      } catch (cause) {
        return error(
          cause instanceof ZodError || cause instanceof Error
            ? cause.message
            : 'Invalid chat completion request.',
          'invalid_request_error',
          400,
        );
      }

      let runtime:
        | ReturnType<typeof createPilotConversationRuntime>
        | ReturnType<typeof createPilotResearchRuntime>
        | undefined;
      let closeRuntime = true;

      try {
        if (command.baseAgentId === 'research') {
          if (process.env.PILOT_ENABLE_RESEARCH !== 'true') {
            return error(
              'Pilot Research is not enabled.',
              'invalid_request_error',
              403,
            );
          }

          const oidcToken = request.headers.get('x-pilot-runtime-oidc-token');
          if (!oidcToken) {
            return error('Unauthorized.', 'authentication_error', 401);
          }
          runtime = createPilotResearchRuntime(storageConfig, oidcToken);
        } else {
          runtime = createPilotConversationRuntime(storageConfig);
        }

        if (isStreamingChatCompletionRequest(body)) {
          const stream = await runtime.stream(command);
          closeRuntime = false;
          const includeUsage =
            (body as { stream_options?: { include_usage?: boolean } })
              ?.stream_options?.include_usage === true;

          return new Response(
            createChatCompletionStream(stream, {
              includeUsage,
              onClose: async () => {
                await runtime?.close();
              },
            }),
            {
              headers: {
                'cache-control': 'no-cache, no-transform',
                'content-type': 'text/event-stream; charset=utf-8',
                connection: 'keep-alive',
              },
            },
          );
        }

        const result = await runtime.generate(command);
        return Response.json(createChatCompletionResponse(result));
      } catch (cause) {
        console.error(
          '[pilot-conversation] generation failed:',
          cause instanceof Error ? cause.name : 'unknown error',
        );
        return error(
          'Pilot Conversation could not complete.',
          'server_error',
          502,
        );
      } finally {
        if (closeRuntime) {
          await runtime?.close();
        }
      }
    },
  },
);
