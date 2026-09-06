import {
  LibSQLStore,
  LibSQLVector,
} from '@mastra/libsql';

import {
  researchMemoryDatabaseAuthToken,
  researchMemoryDatabaseUrl,
} from '#research/runtime/config/research-agent/storage';

export const memoryStorage = new LibSQLStore({
  id: 'pilot-research-memory-storage',
  url: researchMemoryDatabaseUrl,
  authToken: researchMemoryDatabaseAuthToken,
});

export const memoryVector = new LibSQLVector({
  id: 'pilot-research-memory-vector',
  url: researchMemoryDatabaseUrl,
  authToken: researchMemoryDatabaseAuthToken,
});
