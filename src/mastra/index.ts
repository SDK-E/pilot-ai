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

const isDevelopmentToolsEnabled =
  process.env.PILOT_ENABLE_DEVELOPMENT_TOOLS === "true";

const development = isDevelopmentToolsEnabled
  ? (await import("./development/registration.js")).registration
  : undefined;

const runtimeStorageConfig = getPilotRuntimeStorageConfig();
const runtimeStorage = runtimeStorageConfig
  ? createPilotRuntimeStorage(runtimeStorageConfig)
  : undefined;
const durableWorkConfig = getPilotDurableWorkConfig();

// Every option is a direct property: the Mastra build reads them statically
// and cannot see through spreads.
export const mastra = new Mastra({
  logger,
  storage: development?.storage ?? runtimeStorage,
  agents: development?.agents,
  scorers: development?.scorers,
  workflows: { taskApprovalWorkflow, ...development?.workflows },
  observability: development?.observability,
  editor: development?.editor,
  cache: durableWorkConfig
    ? createPilotDurableWorkCache(durableWorkConfig)
    : undefined,
  server: {
    apiRoutes: [...conversationApiRoutes],
    cors: false,
  },
});
