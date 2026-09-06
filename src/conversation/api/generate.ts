import { registerApiRoute } from '@mastra/core/server';
import { ZodError } from 'zod';

import {
  createPilotConversationRuntime,
  generateConversationReplySchema,
  type GenerateConversationReply,
} from '../pilot-conversation';

const runtimeDatabaseUrl = process.env.PILOT_MASTRA_DATABASE_URL;

export const generateRegistration = registerApiRoute('/pilot/conversations/generate', {
    method: 'POST',
    requiresAuth: false,
    handler: async (context) => {
      if (!runtimeDatabaseUrl) {
        return context.json(
          { error: 'Pilot Conversation runtime is not configured.' },
          503,
        );
      }

      let command: GenerateConversationReply;

      try {
        command = generateConversationReplySchema.parse(
          await context.req.json(),
        );
      } catch (error) {
        if (error instanceof ZodError) {
          return context.json({ error: 'Invalid runtime command.' }, 400);
        }

        return context.json({ error: 'Invalid JSON request body.' }, 400);
      }

      const runtime = createPilotConversationRuntime(runtimeDatabaseUrl);

      try {
        return context.json(await runtime.generate(command));
      } finally {
        await runtime.close();
      }
    },
  });