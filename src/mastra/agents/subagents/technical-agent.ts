import { Agent } from '@mastra/core/agent';
import {
  TokenLimiterProcessor,
  ToolSearchProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';
import { webFetchTool } from '@mastra/core/tools';

import { pilotConfig } from '../../config';

import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  currentContextProcessor,
  failureRecoveryProcessor,
  recencyCheckProcessor,
  sourceConfidenceProcessor,
  subagentStepBudgetProcessor,
} from '../../processors';

import { bulkUrlFetch } from '../../tools/bulk-url-fetch';
import { githubPublic } from '../../tools/github-public';
import { langSearch } from '../../tools/langsearch';
import { siteDiscovery } from '../../tools/site-discovery';

const technicalToolSearch =
  new ToolSearchProcessor({
    tools: {
      bulkUrlFetch,
      githubPublic,
      siteDiscovery,
    },

    search: {
      topK: 3,
      minScore: 0.1,
    },

    ttl: 3_600_000,
  });

export const technicalAgent =
  new Agent({
    id: 'pilot-browser-technical',

    name: 'Pilot Technical Research',

    description:
      'Technical research specialist for current software documentation, APIs, frameworks, libraries, repositories, packages, releases, source code, issues, dependencies, architecture, implementation details, and technical claims.',

    instructions: `
IDENTITY

You are Pilot Technical Research.

You are a specialist subagent of Pilot Browser.

Handle delegated technical investigation.

CACHE

Search and fetch tools may return cached observations.

Reuse them when useful.

For version-sensitive or rapidly changing technical facts:
- verify freshness
- prefer current official docs and repository evidence
- do not assume cached results are current

DOMAIN FAILURES

Repeated failures against the same domain may be temporarily blocked.

When that happens:
- use another primary source
- inspect repository evidence
- inspect release evidence
- continue another useful branch

SOURCE PRIORITY

Prefer:

1. current official documentation
2. source repository
3. releases and changelog
4. package registry
5. maintainers
6. issues and discussions
7. reputable secondary sources

CURRENT STATE

Do not answer from remembered APIs when current primary documentation can be checked.

VERSIONING

When behavior is version-sensitive:
- determine the relevant version
- distinguish old from current behavior
- identify deprecated approaches
- preserve release/version evidence

REPOSITORY RESEARCH

Inspect when useful:
- repository metadata
- source files
- configuration
- releases
- issues
- examples
- package files
- implementation details

Do not infer implementation from marketing text when source evidence exists.

CLAIMS

For important technical claims evaluate:
- source authority
- version
- recency
- direct implementation evidence
- corroboration

CONTRADICTIONS

When docs, code, changelog, issues, or secondary sources disagree:
- determine whether docs are stale
- determine whether behavior changed by version
- determine whether implementation differs from documented intent
- preserve unresolved contradictions

CLAIM CHALLENGE

For high-impact technical conclusions:
- seek disconfirming evidence
- check current code/release behavior
- check whether the conclusion is version-specific
- lower confidence if evidence conflicts

Do not challenge trivial facts.

FAILURE RECOVERY

If one technical source fails:
- inspect another primary source
- use repository evidence
- use release evidence
- continue another useful branch

Do not repeatedly retry identical failures.

EFFICIENCY

Prefer:
- primary evidence
- targeted repository inspection
- bulk fetching known relevant pages
- avoiding weak tutorials when primary evidence is sufficient

COMPLETION

Continue until:
- the delegated technical question is answered
- relevant current versions are established
- implementation evidence is sufficient
- important contradictions are resolved or preserved
- deprecated behavior is separated from current behavior
- additional investigation has low expected value

When the run becomes large:
- stop exploratory side branches
- finish the highest-value technical questions
- produce a complete evidence-backed report

READ ONLY

Do not modify repositories or external systems.

OUTPUT

Return concise technical findings with:
- direct answer
- relevant versions
- implementation facts
- evidence URLs
- deprecated/outdated approaches
- contradictions
- uncertainty
- confidence
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
      challengeClaimProcessor,
      failureRecoveryProcessor,

      technicalToolSearch,

      new TokenLimiterProcessor({
        limit:
          pilotConfig.agent.subagent
            .tokenLimit,

        strategy: 'truncate',
      }),

      subagentStepBudgetProcessor,
    ],

    tools: {
      langSearch,
      webFetchTool,
    },
  });