import { pilotResearchAgent } from './agent';
import { pilotResearchSmokeAgent } from './smoke-agent';
import {
  createResearchDevelopmentObservability,
  createResearchDevelopmentStorage,
} from '#runtime/research/storage';
import {
  buildAnswerRelevancyScorer,
  completenessScorer,
  sourceCoverageScorer,
  taskCompletionScorer,
} from '#runtime/scorers';
import { companyResearchWorkflow } from '#runtime/research/workflows/company-research';
import { deepResearchWorkflow } from '#runtime/research/workflows/deep-research';
import { leadResearchWorkflow } from '#runtime/research/workflows/lead-research';
import { peopleResearchWorkflow } from '#runtime/research/workflows/people-research';
import { technicalResearchWorkflow } from '#runtime/research/workflows/technical-research';
import { webSearchWorkflow } from '#runtime/research/workflows/web-search';
import { createUrlFetchConfig } from '#runtime/research/cache';
import { setRuntimeCache } from '#runtime/cache';
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
} from '#runtime/research/config/research-agent/storage';

setUrlFetchConfig(createUrlFetchConfig());

const client: Client = createClient({
  url: researchMemoryDatabaseUrl,
  authToken: researchMemoryDatabaseAuthToken,
});

setRuntimeCache(client);

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
