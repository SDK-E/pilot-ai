import { ZodError } from 'zod';

import { createPilotConversationRuntime } from '../../../src/conversation/pilot-conversation.js';
import { createPilotResearchRuntime } from '../../../src/research/pilot-research.js';
import {
  createChatCompletionResponse,
  createChatCompletionStream,
  createConversationCommandFromChatCompletion,
  isStreamingChatCompletionRequest,
} from '../../../src/conversation/openai-compatible.js';
import { verifyPilotRuntimeRequest } from '../../../src/runtime/auth/vercel-oidc.js';
import { getPilotRuntimeStorageConfig } from '../../../src/runtime/storage/pilot-runtime.js';

export const config = { runtime: 'nodejs' };

function error(message: string, type: string, status: number): Response {
  return Response.json({ error: { message, type } }, { status });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return error('Method not allowed.', 'invalid_request_error', 405);
    }

    if (!(await verifyPilotRuntimeRequest(request))) {
      return error('Unauthorized.', 'authentication_error', 401);
    }

    const storageConfig = getPilotRuntimeStorageConfig();
    if (!storageConfig) {
      return error('Pilot Conversation is not configured.', 'server_error', 503);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error('Request body must be valid JSON.', 'invalid_request_error', 400);
    }

    let command;
    try {
      command = createConversationCommandFromChatCompletion(body, request.headers);
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
          return error('Pilot Research is not enabled.', 'invalid_request_error', 403);
        }
        const oidcToken = request.headers.get('x-pilot-runtime-oidc-token');
        if (!oidcToken) return error('Unauthorized.', 'authentication_error', 401);
        runtime = createPilotResearchRuntime(storageConfig, oidcToken);
      } else {
        runtime = createPilotConversationRuntime(storageConfig);
      }
      if (isStreamingChatCompletionRequest(body)) {
        const stream = await runtime.stream(command);
        closeRuntime = false;
        return new Response(
          createChatCompletionStream(stream, {
            includeUsage:
              (body as { stream_options?: { include_usage?: boolean } })
                .stream_options?.include_usage === true,
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
      return Response.json(
        createChatCompletionResponse(await runtime.generate(command)),
      );
    } catch (cause) {
      console.error(
        '[pilot-conversation] generation failed:',
        cause instanceof Error ? cause.name : 'unknown error',
      );
      return error('Pilot Conversation could not complete.', 'server_error', 502);
    } finally {
      if (closeRuntime) await runtime?.close();
    }
  },
};
