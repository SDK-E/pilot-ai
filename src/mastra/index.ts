import { Mastra } from "@mastra/core/mastra";

import { logger } from "./logger.js";
import { conversationApiRoutes } from "./server/routes/index.js";
import {
  createPilotRuntimeStorage,
  getPilotRuntimeStorageConfig,
} from "./storage/runtime.js";
import {
  createPilotDurableWorkCache,
  getPilotDurableWorkConfig,
} from "./work/durable-cache.js";
import { taskApprovalWorkflow } from "./workflows/task-approval.js";

const runtimeStorageConfig = getPilotRuntimeStorageConfig();
const durableWorkConfig = getPilotDurableWorkConfig();

// Every option is a direct property: the Mastra build reads them statically
// and cannot see through spreads. Agents are not registered here; each request
// builds its own from the base agent (see agents/runtime).
export const mastra = new Mastra({
  logger,
  storage: runtimeStorageConfig
    ? createPilotRuntimeStorage(runtimeStorageConfig)
    : undefined,
  workflows: { taskApprovalWorkflow },
  cache: durableWorkConfig
    ? createPilotDurableWorkCache(durableWorkConfig)
    : undefined,
  server: {
    apiRoutes: [...conversationApiRoutes],
    cors: false,
  },
});
