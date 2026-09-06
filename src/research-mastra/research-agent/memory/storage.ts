import {
  LibSQLStore,
  LibSQLVector,
} from '@mastra/libsql';

import {
  researchMemoryDatabaseAuthToken,
  researchMemoryDatabaseUrl,
} from '../config/storage';

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
