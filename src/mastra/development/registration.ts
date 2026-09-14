import { createClient } from "@libsql/client";

import { setRuntimePreflightConfig } from "../agents/base/skill-preflight.js";
import { setRuntimeCache } from "../cache/index.js";
import { createSkillFeedback } from "../cache/skill-feedback.js";
import {
  buildAnswerRelevancyScorer,
  completenessScorer,
  sourceCoverageScorer,
  taskCompletionScorer,
} from "../scorers/index.js";
import { createUrlFetchConfig } from "../setup/development-fetch.js";
import {
  developmentDatabaseAuthToken,
  developmentDatabaseUrl,
} from "../storage/development-database.js";
import {
  createDevelopmentObservability,
  createDevelopmentStorage,
} from "../storage/development.js";
import { createResultStore } from "../storage/result-store.js";
import { setLangSearchConfig } from "../tools/search/langsearch.js";
import { setWebSearchConfig } from "../tools/search/web-search.js";
import { setUrlFetchConfig } from "../tools/web/url-fetch.js";
import { companyProfileWorkflow } from "../workflows/company-profile.js";
import { deepDiveWorkflow } from "../workflows/deep-dive.js";
import { leadDiscoveryWorkflow } from "../workflows/lead-discovery.js";
import { peopleProfileWorkflow } from "../workflows/people-profile.js";
import { technicalReviewWorkflow } from "../workflows/technical-review.js";
import { webSearchWorkflow } from "../workflows/web-search.js";

import { developmentAgent } from "./agent.js";
import { developmentSmokeAgent } from "./smoke-agent.js";

setUrlFetchConfig(createUrlFetchConfig());

const client = createClient({
  url: developmentDatabaseUrl,
  authToken: developmentDatabaseAuthToken,
});

setRuntimeCache(client);

const resultStore = createResultStore({
  client,
  tableName: "pilot_results",
});

const skillFeedback = createSkillFeedback({
  client,
  tableName: "pilot_skill_feedback",
});

setLangSearchConfig({});
setWebSearchConfig({ performStagehandSearch: true });
setRuntimePreflightConfig({});

const answerRelevancyScorer = buildAnswerRelevancyScorer();

export const registration = {
  agents: {
    developmentAgent,
    developmentSmokeAgent,
  },
  scorers: {
    answerRelevancyScorer,
    completenessScorer,
    sourceCoverageScorer,
    taskCompletionScorer,
  },
  workflows: {
    companyProfileWorkflow,
    deepDiveWorkflow,
    leadDiscoveryWorkflow,
    peopleProfileWorkflow,
    technicalReviewWorkflow,
    webSearchWorkflow,
  },
  storage: await createDevelopmentStorage(),
  ...createDevelopmentObservability(),
};
