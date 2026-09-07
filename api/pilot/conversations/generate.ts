import { ZodError } from 'zod';

import { createPilotConversationRuntime } from '../../../src/conversation/pilot-conversation.js';
import { getPilotRuntimeStorageConfig } from '../../../src/runtime/storage/pilot-runtime.js';

export const config = {
  runtime: 'nodejs',
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(null, {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }

    const storageConfig = getPilotRuntimeStorageConfig();

    if (!storageConfig) {
      return json(
        { error: 'Pilot Conversation is not configured.' },
        503,
      );
    }

    let command: unknown;

    try {
      command = await request.json();
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400);
    }

    let runtime: ReturnType<typeof createPilotConversationRuntime> | undefined;

    try {
      runtime = createPilotConversationRuntime(storageConfig);
      return json(await runtime.generate(command));
    } catch (error) {
      if (error instanceof ZodError) {
        return json({ error: 'Request command is invalid.' }, 400);
      }

      console.error(
        '[pilot-conversation] generation failed:',
        error instanceof Error ? error.name : 'unknown error',
      );

      return json({ error: 'Pilot Conversation could not complete.' }, 502);
    } finally {
      await runtime?.close();
    }
  },
};
