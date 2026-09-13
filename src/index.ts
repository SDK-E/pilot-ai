import { Mastra } from "@mastra/core/mastra";

import { conversationApiRoutes } from "./conversation/api/index.js";
import { logger } from "./runtime/logger.js";
import {
  createPilotRuntimeStorage,
  getPilotRuntimeStorageConfig,
} from "./runtime/storage/pilot-runtime.js";
import {
  createPilotDurableWorkCache,
  getPilotDurableWorkConfig,
} from "./runtime/work/durable-work.js";
import { taskApprovalWorkflow } from "./runtime/workflows/task-approval.js";

const isResearchEnabled =
  process.env.PILOT_ENABLE_DEVELOPMENT_RESEARCH === "true";

const researchRuntime = isResearchEnabled
  ? await import("./research/registration.js")
  : undefined;

const runtimeStorageConfig = getPilotRuntimeStorageConfig();

const storage = runtimeStorageConfig
  ? createPilotRuntimeStorage(runtimeStorageConfig)
  : undefined;
const durableWorkConfig = getPilotDurableWorkConfig();

const runtimeRegistration = researchRuntime?.registration ?? { storage };

export const mastra = new Mastra({
  ...runtimeRegistration,
  logger,
  cache: durableWorkConfig
    ? createPilotDurableWorkCache(durableWorkConfig)
    : undefined,
  workflows: { taskApprovalWorkflow },
  server: {
    apiRoutes: [...conversationApiRoutes],
    cors: false,
  },
});
