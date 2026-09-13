import { Mastra } from '@mastra/core/mastra';

import { conversationApiRoutes } from './conversation/api';
import { taskApprovalWorkflow } from './runtime/workflows/task-approval';
import {
  createPilotRuntimeStorage,
  getPilotRuntimeStorageConfig,
} from '#runtime/storage/pilot-runtime';
import {
  createPilotDurableWorkCache,
  getPilotDurableWorkConfig,
} from '#runtime/work/durable-work';

const researchEnabled = process.env.PILOT_ENABLE_DEVELOPMENT_RESEARCH === 'true';

const researchRuntime = researchEnabled
  ? await import('./research/registration')
  : undefined;

const runtimeStorageConfig = getPilotRuntimeStorageConfig();

const storage = runtimeStorageConfig
  ? createPilotRuntimeStorage(runtimeStorageConfig)
  : undefined;
const durableWorkConfig = getPilotDurableWorkConfig();

const runtimeRegistration = researchRuntime?.registration ?? { storage };

export const mastra = new Mastra({
  ...runtimeRegistration,
  cache: durableWorkConfig
    ? createPilotDurableWorkCache(durableWorkConfig)
    : undefined,
  workflows: { taskApprovalWorkflow },
  server: {
    apiRoutes: [
      ...conversationApiRoutes,
    ],
    cors: false,
  },
});
