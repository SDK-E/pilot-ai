import { LibSQLStore, LibSQLVector } from "@mastra/libsql";

import {
  developmentDatabaseAuthToken,
  developmentDatabaseUrl,
} from "./development-database.js";

export const memoryStorage = new LibSQLStore({
  id: "pilot-research-memory-storage",
  url: developmentDatabaseUrl,
  authToken: developmentDatabaseAuthToken,
});

export const memoryVector = new LibSQLVector({
  id: "pilot-research-memory-vector",
  url: developmentDatabaseUrl,
  authToken: developmentDatabaseAuthToken,
});
