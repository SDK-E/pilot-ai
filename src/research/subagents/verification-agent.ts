import { Agent } from '@mastra/core/agent';
import {
  TokenLimiterProcessor,
  ToolSearchProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';

import { pilotConfig } from '#research/runtime/config';

import {
  currentContextProcessor,
  failureRecoveryProcessor,
} from '#runtime/processors';

import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  entityResolutionProcessor,
  recencyCheckProcessor,
  runtimeSkillResolverProcessor,
  sourceConfidenceProcessor,
  sourceDiversityProcessor,
  subagentStepBudgetProcessor,
} from '#research/runtime/processors';

import { bulkUrlFetch } from '#runtime/tools/bulk-url-fetch';
import { csvFile } from '#runtime/tools/csv-file';
import { domainIntelligence } from '#runtime/tools/domain-intelligence';
import { exportResults } from '#runtime/tools/export-results';
import { exportValidator } from '#runtime/tools/export-validator';
import { githubPublic } from '#research/runtime/tools/github-public';
import { markdownFile } from '#runtime/tools/markdown-file';
import { queryPlanner } from '#runtime/tools/query-planner';
import { researchScratchpad } from '#runtime/tools/research-scratchpad';
import { resultCollector } from '#runtime/tools/result-collector';
import { searchDorks } from '#runtime/tools/search/search-dorks';
import { siteDiscovery } from '#runtime/tools/site-discovery';
import { skillsMarketplace } from '#research/runtime/tools/skills-marketplace';
import { stagehandBrowser } from '#research/runtime/tools/stagehand-browser';
import { structuredData } from '#runtime/tools/structured-data';
import { webSearch } from '#runtime/tools/search/web-search';

const verificationToolSearch = new ToolSearchProcessor({
  tools: {
    bulkUrlFetch,
    siteDiscovery,
    structuredData,
    domainIntelligence,
    githubPublic,
    exportValidator,
    exportResults,
    csvFile,
    markdownFile,
  },
  search: { topK: 5, minScore: 0.1 },
  ttl: 3_600_000,
});

export const verificationAgent = new Agent({
  id: 'pilot-research-verification',
  name: 'Pilot Verification',
  description:
    'General-purpose evidence verification specialist for validating public claims, entities, identities, dates, current status, source quality, contradictions, recency, domains, and explicitly public professional information.',

  instructions: `
IDENTITY

You are Pilot Verification, a specialist subagent of Pilot Research Agent.
Your purpose is evidence validation.

TOOL SEMANTICS

Use webSearch or searchDorks for public internet search.
search_tools is NOT web search. It searches Pilot's internal deferred tool registry only.
Use search_tools only for specialized internal capabilities that are not directly available.
Never use search_tools to find public internet information.

QUERY PLANNING

For difficult or multi-claim verification, call queryPlanner before searching.
Use distinct evidence paths rather than one large query.
When another round is needed, adapt from observed result/useful counts instead of repeating failed wording.

CURRENT DATE

The runtime current-context system message is authoritative.
For current claims, anchor verification to that date and prefer fresh primary evidence.
Do not add old years unless intentionally relevant.

VERIFY

For important delegated claims determine what exactly is claimed, what directly supports it, whether the evidence is current enough, whether identity resolution is correct, and whether independent evidence agrees.

SOURCE PRIORITY

Prefer official/primary sources, authoritative specialist sources, reputable independent sources, then directories/aggregators.
Use snippets only as discovery clues.

CONFIDENCE

HIGH: strong primary evidence or strong independent corroboration.
MEDIUM: credible but incomplete or indirect evidence.
LOW: weak, stale, ambiguous, conflicting, or poorly corroborated evidence.

RECENCY

For time-sensitive information verify publication/update/observed dates and active/current status.

IDENTITY

Verify canonical entity identity, person-role-company, company-domain, and similar-name ambiguity.
Do not merge identities without evidence.

CONTRADICTIONS

When sources disagree, compare authority and recency, seek stronger primary evidence, and preserve unresolved uncertainty.

PUBLIC CONTACT INFORMATION

Only return explicitly public professional information.
Never guess email patterns, generate addresses, or infer private phone/personal information.

FAILURE RECOVERY

If one source fails, seek another primary or independent path.
Do not repeatedly retry identical failures.

READ ONLY

Do not modify external systems.

OUTPUT

Return a concise verification report with verified facts, evidence URLs, confidence, contradictions, unresolved gaps, and rejected claims when important.
`,

  model: [
    {
      model: pilotConfig.model.id,
      maxRetries: pilotConfig.model.maxRetries,
    },
  ],

  defaultOptions: {
    maxSteps: pilotConfig.agent.subagent.maxSteps,
  },

  inputProcessors: [
    new UnicodeNormalizer({
      stripControlChars: true,
      collapseWhitespace: true,
    }),
    currentContextProcessor,
    runtimeSkillResolverProcessor,
    sourceConfidenceProcessor,
    recencyCheckProcessor,
    contradictionCheckProcessor,
    entityResolutionProcessor,
    sourceDiversityProcessor,
    challengeClaimProcessor,
    failureRecoveryProcessor,
    verificationToolSearch,
    new TokenLimiterProcessor({
      limit: pilotConfig.agent.subagent.tokenLimit,
      strategy: 'truncate',
    }),
    subagentStepBudgetProcessor,
  ],

  tools: {
    queryPlanner,
    webSearch,
    searchDorks,
    stagehandBrowser,
    skillsMarketplace,
    researchScratchpad,
    resultCollector,
  },
});