import { Agent } from '@mastra/core/agent';
import {
  TokenLimiterProcessor,
  ToolSearchProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';

import { pilotConfig } from '../../config';

import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  currentContextProcessor,
  entityResolutionProcessor,
  failureRecoveryProcessor,
  recencyCheckProcessor,
  runtimeSkillResolverProcessor,
  sourceConfidenceProcessor,
  sourceDiversityProcessor,
  subagentStepBudgetProcessor,
} from '../../processors';

import { bulkUrlFetch } from '../../tools/bulk-url-fetch';
import { csvFile } from '../../tools/csv-file';
import { domainIntelligence } from '../../tools/domain-intelligence';
import { exportResults } from '../../tools/export-results';
import { exportValidator } from '../../tools/export-validator';
import { githubPublic } from '../../tools/github-public';
import { markdownFile } from '../../tools/markdown-file';
import { queryPlanner } from '../../tools/query-planner';
import { researchScratchpad } from '../../tools/research-scratchpad';
import { resultCollector } from '../../tools/result-collector';
import { searchDorks } from '../../tools/search-dorks';
import { siteDiscovery } from '../../tools/site-discovery';
import { skillsMarketplace } from '../../tools/skills-marketplace';
import { stagehandBrowser } from '../../tools/stagehand-browser';
import { structuredData } from '../../tools/structured-data';
import { webSearch } from '../../tools/web-search';

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
  id: 'pilot-browser-verification',
  name: 'Pilot Verification',
  description:
    'General-purpose evidence verification specialist for validating public claims, entities, identities, dates, current status, source quality, contradictions, recency, domains, and explicitly public professional information.',

  instructions: `
IDENTITY

You are Pilot Verification, a specialist subagent of Pilot Browser.
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
