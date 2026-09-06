import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { PostgresStore } from '@mastra/pg';
import { ZodError } from 'zod';

import {
  createConversationResourceId,
  createPilotConversationRuntime,
  generateConversationReplySchema,
  type GenerateConversationReply,
} from './conversation/pilot-conversation';

export {
  createConversationResourceId,
  createPilotConversationRuntime,
  generateConversationReplySchema,
  type GenerateConversationReply,
} from './conversation/pilot-conversation';

const runtimeDatabaseUrl = process.env.PILOT_MASTRA_DATABASE_URL;

const apiRoutes = [
  registerApiRoute('/pilot/conversations/generate', {
    method: 'POST',
    // Vercel Deployment Protection and Trusted Sources authenticate Pilot before
    // this handler. This route must never be exposed through a public domain.
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
  }),
];

const storage = runtimeDatabaseUrl
  ? new PostgresStore({
      id: 'pilot-runtime-storage',
      connectionString: runtimeDatabaseUrl,
      schemaName: 'pilot_ai',
    })
  : undefined;

export const mastra = new Mastra({
  storage,
  server: {
    apiRoutes,
    cors: false,
  },
});
