import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';

import { conversationApiRoutes } from './conversation/api';

const researchEnabled = process.env.PILOT_ENABLE_RESEARCH === 'true';

const researchRuntime = researchEnabled
  ? await import('./research/registration')
  : undefined;

const runtimeDatabaseUrl = process.env.PILOT_MASTRA_DATABASE_URL;

const storage = runtimeDatabaseUrl
  ? new PostgresStore({
      id: 'pilot-runtime-storage',
      connectionString: runtimeDatabaseUrl,
      schemaName: 'pilot_ai',
    })
  : undefined;

const runtimeRegistration = researchRuntime?.registration ?? { storage };

export const mastra = new Mastra({
  ...runtimeRegistration,
  server: {
    apiRoutes: [
      ...conversationApiRoutes,
    ],
    cors: false,
  },
});
