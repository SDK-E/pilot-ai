import {
  LibSQLStore,
  LibSQLVector,
} from '@mastra/libsql';

const databaseUrl =
  process.env.MASTRA_MEMORY_DATABASE_URL ??
  'file:./pilot-memory.db';

const authToken =
  process.env.MASTRA_MEMORY_DATABASE_AUTH_TOKEN;

export const memoryStorage = new LibSQLStore({
  id: 'pilot-browser-memory-storage',
  url: databaseUrl,
  authToken,
});

export const memoryVector = new LibSQLVector({
  id: 'pilot-browser-memory-vector',
  url: databaseUrl,
  authToken,
});