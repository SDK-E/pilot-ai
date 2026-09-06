import { pilotResearchAgent } from './agent';
import { pilotResearchSmokeAgent } from './smoke-agent';
import {
  createResearchDevelopmentObservability,
  createResearchDevelopmentStorage,
} from '#research/runtime/storage';
import {
  buildAnswerRelevancyScorer,
  completenessScorer,
  sourceCoverageScorer,
  taskCompletionScorer,
} from '#runtime/scorers';
import { companyResearchWorkflow } from '#research/runtime/workflows/company-research';
import { deepResearchWorkflow } from '#research/runtime/workflows/deep-research';
import { leadResearchWorkflow } from '#research/runtime/workflows/lead-research';
import { peopleResearchWorkflow } from '#research/runtime/workflows/people-research';
import { technicalResearchWorkflow } from '#research/runtime/workflows/technical-research';
import { webSearchWorkflow } from '#research/runtime/workflows/web-search';
import { createUrlFetchConfig } from '#research/runtime/cache';
import { setUrlFetchConfig } from '#runtime/tools/url-fetch';
import { setLangSearchConfig } from '#runtime/tools/search/langsearch';
import { setWebSearchConfig } from '#runtime/tools/search/web-search';
import { setRuntimePreflightConfig } from '#runtime/skills/runtime-preflight';
import { createClient, type Client } from '@libsql/client';
import {
  createResultStore,
} from '#runtime/storage/research-result-store';
import {
  createSkillFeedback,
} from '#runtime/cache/skill-feedback';
import {
  researchMemoryDatabaseAuthToken,
  researchMemoryDatabaseUrl,
} from '#research/runtime/config/research-agent/storage';

setUrlFetchConfig(createUrlFetchConfig());

const client: Client = createClient({
  url: researchMemoryDatabaseUrl,
  authToken: researchMemoryDatabaseAuthToken,
});

const resultStore = createResultStore({
  client,
  tableName: 'pilot_research_results',
});

const skillFeedback = createSkillFeedback({
  client,
  tableName: 'pilot_skill_feedback',
});

setLangSearchConfig({});
setWebSearchConfig({ performStagehandSearch: true });
setRuntimePreflightConfig({});

const answerRelevancyScorer = buildAnswerRelevancyScorer();

export const registration = {
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
};