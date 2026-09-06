import { Agent } from '@mastra/core/agent';
import {
  TokenLimiterProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';

import { pilotConfig } from '../../config';

import {
  currentContextProcessor,
  entityResolutionProcessor,
  failureRecoveryProcessor,
  recencyCheckProcessor,
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
import { researchScratchpad } from '../../tools/research-scratchpad';
import { resultCollector } from '../../tools/result-collector';
import { searchDorks } from '../../tools/search-dorks';
import { siteDiscovery } from '../../tools/site-discovery';
import { skillsMarketplace } from '../../tools/skills-marketplace';
import { stagehandBrowser } from '../../tools/stagehand-browser';
import { structuredData } from '../../tools/structured-data';
import { webSearch } from '../../tools/web-search';

export const discoveryAgent =
  new Agent({
    id: 'pilot-browser-discovery',

    name: 'Pilot Discovery',

    description:
      'Fast general-purpose web discovery specialist for finding relevant public entities, sources, pages, documents, companies, people, products, jobs, technologies, repositories, events, and other candidate information.',

    instructions: `
IDENTITY

You are Pilot Discovery.

You are a specialist subagent of Pilot Browser.

Your purpose is fast, broad, high-quality discovery.

Use the delegated objective exactly as provided by the supervisor.

TOOL SEMANTICS

Use webSearch or searchDorks for public internet search.

Never treat an internal tool-discovery function such as search_tools as Google or public-web search. If such a function is present, it only discovers registered agent tools.

You have direct access to the research toolset. Do not waste steps searching for a tool that is already available.

CURRENT DATE

The runtime current-context system message is authoritative.

For current/recent work, anchor searches to that date. Do not spray old years into keywords. Add a year only when it intentionally improves precision.

QUERY QUALITY

Search for evidence, not just topics.

Combine the subject with useful signals such as role, hiring, freelance, contractor, consulting, procurement, transformation, funding, migration, expansion, vendor, tender, or other intent terms appropriate to the objective.

Use searchDorks for targeted site:, intitle:, inurl:, filetype:, exact-phrase, exclusion, OR, and date-bounded searches.

CACHE

Search and fetch tools may return cached observations.

Reuse them when useful.

For time-sensitive work:
- verify freshness when necessary
- prefer newer primary evidence
- do not treat cached observations as automatically current

DOMAIN FAILURES

Repeated failures against the same domain may be temporarily blocked.

When that happens:
- use another source
- use another primary page
- continue another useful branch
- do not hammer the same failing domain

OBJECTIVE

Discover the strongest useful candidate information and evidence for your assigned branch.

You are responsible primarily for breadth.

Do not perform exhaustive verification unless lightweight verification is necessary to avoid returning obviously bad candidates.

DISCOVERY

Generate useful independent search directions when needed.

Search using:
- entity names
- aliases
- synonyms
- geography
- dates only when useful
- relevant terminology
- source-specific terminology
- intent and evidence signals

Avoid semantically equivalent searches.

For broad discovery:
- explore multiple useful query families
- prioritize strong candidates
- stop expanding weak branches
- remove obvious duplicates

SOURCES

Prefer:
1. primary sources
2. authoritative specialist sources
3. reputable secondary sources

Treat aggregators, directories, copied pages, and search snippets as weaker evidence.

SOURCE DIVERSITY

Do not treat several pages repeating the same source as independent corroboration.

RECENCY

When time-sensitive:
- prefer current sources
- preserve dates
- avoid stale candidates

ENTITY RESOLUTION

Resolve obvious duplicates.

Preserve canonical identifiers when possible.

Do not merge distinct entities merely because names are similar.

FAILURE RECOVERY

If a source or tool fails:
- try another evidence path
- do not repeatedly retry identical failing calls
- preserve partial useful results

READ ONLY

Do not modify external systems.

OUTPUT

Return concise findings and evidence to Pilot Browser.

Stay within the delegated objective.
`,

    model: [
      {
        model:
          pilotConfig.model.id,

        maxRetries:
          pilotConfig.model
            .maxRetries,
      },
    ],

    defaultOptions: {
      maxSteps:
        pilotConfig.agent.subagent
          .maxSteps,
    },

    inputProcessors: [
      new UnicodeNormalizer({
        stripControlChars: true,
        collapseWhitespace: true,
      }),

      currentContextProcessor,
      recencyCheckProcessor,
      entityResolutionProcessor,
      sourceDiversityProcessor,
      failureRecoveryProcessor,

      new TokenLimiterProcessor({
        limit:
          pilotConfig.agent.subagent
            .tokenLimit,

        strategy: 'truncate',
      }),

      subagentStepBudgetProcessor,
    ],

    tools: {
      webSearch,
      searchDorks,
      stagehandBrowser,
      skillsMarketplace,
      bulkUrlFetch,
      siteDiscovery,
      structuredData,
      domainIntelligence,
      githubPublic,
      researchScratchpad,
      resultCollector,
      exportValidator,
      exportResults,
      csvFile,
      markdownFile,
    },
  });