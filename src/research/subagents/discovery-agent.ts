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
  entityResolutionProcessor,
  recencyCheckProcessor,
  runtimeSkillResolverProcessor,
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

const discoveryToolSearch =
  new ToolSearchProcessor({
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

export const discoveryAgent = new Agent({
  id: 'pilot-research-discovery',
  name: 'Pilot Discovery',
  description:
    'Fast general-purpose web discovery specialist for finding relevant public entities, sources, pages, documents, companies, people, products, jobs, technologies, repositories, events, and other candidate information.',

  instructions: `
IDENTITY

You are Pilot Discovery, a specialist subagent of Pilot Research Agent.
Your purpose is fast, broad, high-quality discovery.
Use the delegated objective exactly as provided by the supervisor.

TOOL SEMANTICS

Use webSearch or searchDorks for public internet search.
search_tools is NOT web search. It searches Pilot's internal deferred tool registry only.
Use search_tools only when you need a specialized capability that is not already directly available.
Never use search_tools to look for websites, people, companies, jobs, news, documents, products, or public information.

QUERY PLANNING

For broad, ambiguous, or difficult discovery, call queryPlanner before searching.
Run several distinct query strategies instead of one giant query.
After meaningful attempts, call queryPlanner with action="adapt" and observed result/useful counts when another round is needed.
Stop repeating query shapes that produced nothing.

CURRENT DATE

The runtime current-context system message is authoritative.
For current/recent work, anchor searches to that date.
Do not spray old years into keywords. Add a year only when it intentionally improves precision.

QUERY QUALITY

Search for evidence, not just topics.
Combine the subject with useful intent/evidence signals appropriate to the objective.
Use searchDorks for targeted site:, intitle:, inurl:, filetype:, exact-phrase, exclusion, OR, and date-bounded searches.
Prefer smaller independent queries over over-constrained Boolean walls.

SOURCES

Prefer primary sources, then authoritative specialist sources, then reputable secondary sources.
Treat aggregators, directories, copied pages, and snippets as weaker evidence.

RECENCY

When time-sensitive, prefer current sources, preserve dates, and avoid stale candidates.

ENTITY RESOLUTION

Resolve obvious duplicates and preserve canonical identifiers when possible.
Do not merge distinct entities merely because names are similar.

FAILURE RECOVERY

If a source or tool fails, try another evidence path.
Do not repeatedly retry identical failing calls.
Preserve partial useful results.

READ ONLY

Do not modify external systems.

OUTPUT

Return concise findings and evidence to Pilot Research Agent.
Stay within the delegated objective.
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
    recencyCheckProcessor,
    entityResolutionProcessor,
    sourceDiversityProcessor,
    failureRecoveryProcessor,
    discoveryToolSearch,
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