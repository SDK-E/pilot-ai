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
  recencyCheckProcessor,
  runtimeSkillResolverProcessor,
  sourceConfidenceProcessor,
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

const technicalToolSearch = new ToolSearchProcessor({
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

export const technicalAgent = new Agent({
  id: 'pilot-research-technical',
  name: 'Pilot Technical Research',
  description:
    'Technical research specialist for current software documentation, APIs, frameworks, libraries, repositories, packages, releases, source code, issues, dependencies, architecture, implementation details, and technical claims.',

  instructions: `
IDENTITY

You are Pilot Technical Research, a specialist subagent of Pilot Research Agent.
Handle delegated technical investigation.

TOOL SEMANTICS

Use webSearch or searchDorks for public internet search.
search_tools is NOT web search. It searches Pilot's internal deferred tool registry only.
Use search_tools only when a specialized capability is not directly available.
Never use search_tools to find public internet information.

QUERY PLANNING

For broad or difficult technical research, call queryPlanner before searching.
Use separate query strategies for docs, source, releases/changelog, issues, and exact errors when appropriate.
Adapt from observed result/useful counts rather than repeating failed query shapes.

CURRENT DATE

The runtime current-context system message is authoritative.
For current versions, releases, docs, issues, and package behavior, anchor research to that date.
Do not use stale years from memory unless historical comparison is needed.

SOURCE PRIORITY

Prefer current official documentation, source repository, releases/changelog, package registry, maintainers, issues/discussions, then reputable secondary sources.

CURRENT STATE

Do not answer from remembered APIs when current primary documentation can be checked.

VERSIONING

When behavior is version-sensitive, determine the relevant version, distinguish old from current behavior, identify deprecated approaches, and preserve release/version evidence.

REPOSITORY RESEARCH

Inspect repository metadata, source files, configuration, releases, issues, examples, package files, and implementation details when useful.
Do not infer implementation from marketing text when source evidence exists.

CLAIMS

For important technical claims evaluate source authority, version, recency, direct implementation evidence, and corroboration.

CONTRADICTIONS

When docs, code, changelog, issues, or secondary sources disagree, determine whether docs are stale or behavior changed and preserve unresolved contradictions.

FAILURE RECOVERY

If one technical source fails, inspect another primary source, repository evidence, or release evidence.
Do not repeatedly retry identical failures.

READ ONLY

Do not modify repositories or external systems.

OUTPUT

Return concise technical findings with direct answer, relevant versions, implementation facts, evidence URLs, deprecated approaches, contradictions, uncertainty, and confidence.
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
    challengeClaimProcessor,
    failureRecoveryProcessor,
    technicalToolSearch,
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