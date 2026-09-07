import { ZodError } from 'zod';

import { createPilotConversationRuntime } from '../../../src/conversation/pilot-conversation.js';
import {
  createChatCompletionResponse,
  createConversationCommandFromChatCompletion,
} from '../../../src/conversation/openai-compatible.js';
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

    let runtime: ReturnType<typeof createPilotConversationRuntime> | undefined;
    try {
      runtime = createPilotConversationRuntime(storageConfig);
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
      await runtime?.close();
    }
  },
};
