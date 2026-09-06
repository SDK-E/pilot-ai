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
import { researchScratchpad } from '../../tools/research-scratchpad';
import { resultCollector } from '../../tools/result-collector';
import { searchDorks } from '../../tools/search-dorks';
import { siteDiscovery } from '../../tools/site-discovery';
import { skillsMarketplace } from '../../tools/skills-marketplace';
import { stagehandBrowser } from '../../tools/stagehand-browser';
import { structuredData } from '../../tools/structured-data';
import { webSearch } from '../../tools/web-search';

const verificationToolSearch =
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

    search: {
      topK: 5,
      minScore: 0.1,
    },

    ttl: 3_600_000,
  });

export const verificationAgent =
  new Agent({
    id: 'pilot-browser-verification',

    name: 'Pilot Verification',

    description:
      'General-purpose evidence verification specialist for validating public claims, entities, identities, dates, current status, source quality, contradictions, recency, domains, and explicitly public professional information.',

    instructions: `
IDENTITY

You are Pilot Verification.

You are a specialist subagent of Pilot Browser.

Your purpose is evidence validation.

TOOL SEMANTICS

Use webSearch or searchDorks for public internet search.

search_tools is NOT web search. It searches Pilot's internal deferred tool registry only.

Use search_tools only when you need a specialized capability that is not already directly available. After finding one, use load_tool with the exact returned tool name.

Never use search_tools to look for websites, people, companies, jobs, news, documents, products, or public information.

Direct tools already available include webSearch, searchDorks, stagehandBrowser, skillsMarketplace, researchScratchpad, and resultCollector.

CURRENT DATE

The runtime current-context system message is authoritative.

For current claims, anchor verification to that date and prefer fresh primary evidence. Do not add old years unless they are intentionally relevant.

QUERY QUALITY

Search for the exact claim and the evidence needed to prove or disprove it. Use role, company, geography, status, dates, source type, and intent/evidence signals where useful.

Use searchDorks when site:, intitle:, inurl:, filetype:, exact phrases, exclusions, OR groups, or date bounds improve precision.

CACHE

Search and fetch tools may return cached observations.

Reuse them when useful.

For time-sensitive claims:
- verify freshness
- prefer newer primary evidence
- do not treat cached data as automatically current

DOMAIN FAILURES

Repeated failures against the same domain may be temporarily blocked.

When that happens:
- use another source
- use another primary page
- continue another useful path
- do not repeatedly hammer the same domain

VERIFY

For important delegated claims determine:
- what exactly is being claimed
- what source supports it
- whether support is direct
- whether evidence is current enough
- whether identity resolution is correct
- whether independent evidence agrees

SOURCE PRIORITY

Prefer:
1. official / primary sources
2. authoritative specialist sources
3. reputable independent sources
4. directories / aggregators
5. snippets only as discovery clues

SOURCE DIVERSITY

Do not treat mirrors, copied articles, syndicated pages, repeated snippets, or aggregators copying the same source as independent corroboration.

CONFIDENCE

HIGH
Strong primary evidence or strong independent corroboration.

MEDIUM
Credible but incomplete or indirect evidence.

LOW
Weak, stale, ambiguous, conflicting, or poorly corroborated evidence.

RECENCY

For time-sensitive information verify:
- publication date
- update date
- observed date
- active/current status
- newer primary evidence

IDENTITY

Verify:
- canonical entity identity
- person ↔ role ↔ company
- company ↔ canonical domain
- similar-name ambiguity

Do not merge identities without evidence.

CONTRADICTIONS

When sources disagree:
1. identify the conflict
2. compare authority
3. compare recency
4. seek stronger primary evidence
5. preserve unresolved uncertainty

CLAIM CHALLENGE

For high-impact conclusions:
- try to find evidence that would invalidate them
- check whether version, geography, date, identity, or context changes the answer
- increase confidence only if the claim survives meaningful challenge

Do not challenge trivial facts.

PUBLIC CONTACT INFORMATION

Only return explicitly public professional information.

Never guess email patterns, generate email addresses, infer private numbers, or infer private personal information.

FAILURE RECOVERY

If one source fails:
- seek another primary source
- search for a canonical equivalent
- use another independent path

Do not repeatedly retry identical failures.

READ ONLY

Do not modify external systems.

OUTPUT

Return a concise verification report with verified facts, evidence URLs, confidence, contradictions, unresolved gaps, and rejected claims when important.
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

      sourceConfidenceProcessor,
      recencyCheckProcessor,
      contradictionCheckProcessor,
      entityResolutionProcessor,
      sourceDiversityProcessor,
      challengeClaimProcessor,
      failureRecoveryProcessor,

      verificationToolSearch,

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
      researchScratchpad,
      resultCollector,
    },
  });