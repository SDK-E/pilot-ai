import { Mastra } from '@mastra/core/mastra';

import { pilotResearchAgent } from './research-agent/agent';
import { pilotResearchSmokeAgent } from './research-agent/smoke-agent';
import {
  createResearchDevelopmentObservability,
  createResearchDevelopmentStorage,
} from './development';
import { seedPilotDatasets } from './evals/seed-pilot-dataset';
import {
  answerRelevancyScorer,
  completenessScorer,
  sourceCoverageScorer,
  taskCompletionScorer,
} from './scorers';
import { companyResearchWorkflow } from './workflows/company-research';
import { deepResearchWorkflow } from './workflows/deep-research';
import { leadResearchWorkflow } from './workflows/lead-research';
import { peopleResearchWorkflow } from './workflows/people-research';
import { technicalResearchWorkflow } from './workflows/technical-research';
import { webSearchWorkflow } from './workflows/web-search';

export const mastra = new Mastra({
  agents: {
    pilotResearchAgent,
    pilotResearchSmokeAgent,
  },
  scorers: {
    answerRelevancyScorer,
    completenessScorer,
    sourceCoverageScorer,
    taskCompletionScorer,
  },
  workflows: {
    companyResearchWorkflow,
    deepResearchWorkflow,
    leadResearchWorkflow,
    peopleResearchWorkflow,
    technicalResearchWorkflow,
    webSearchWorkflow,
  },
  storage: await createResearchDevelopmentStorage(),
  ...createResearchDevelopmentObservability(),
});

await seedPilotDatasets(mastra);
