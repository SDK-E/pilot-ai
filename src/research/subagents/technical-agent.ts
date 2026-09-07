import { pilotConfig } from '#runtime/research/config';
import { createBaseAgent } from '#runtime/agent/base-agent';
import { buildBaseAgentInstructions } from '#runtime/agent/base-instructions';

import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  recencyCheckProcessor,
  runtimeSkillResolverProcessor,
  sourceConfidenceProcessor,
} from '#runtime/research/processors';
import { queryPlanner } from '#runtime/tools/query-planner';
import { researchScratchpad } from '#runtime/tools/research-scratchpad';
import { resultCollector } from '#runtime/tools/result-collector';
import { searchDorks } from '#runtime/tools/search/search-dorks';
import { skillsMarketplace } from '#runtime/research/tools/skills-marketplace';
import { stagehandBrowser } from '#runtime/research/tools/stagehand-browser';
import { webSearch } from '#runtime/tools/search/web-search';
import { createResearchToolSearchProcessor } from '../tool-search';
import { technicalAgentIdentity } from './identity';

const technicalToolSearch = createResearchToolSearchProcessor();

export const technicalAgent = createBaseAgent({
  base: {
    maxSteps: pilotConfig.agent.subagent.maxSteps,
    tokenLimit: pilotConfig.agent.subagent.tokenLimit,
    warningAt: pilotConfig.agent.subagent.stepBudget.warningAt,
    finalAt: pilotConfig.agent.subagent.stepBudget.finalAt,
  },
  id: 'pilot-research-technical',
  name: technicalAgentIdentity.name,
  description: technicalAgentIdentity.jobDescription,

  instructions: [
    buildBaseAgentInstructions(technicalAgentIdentity),
    `
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
`.trim(),
  ].join('\n\n'),

  model: [
    {
      model: pilotConfig.model.id,
      maxRetries: pilotConfig.model.maxRetries,
    },
  ],

  inputProcessors: [
    runtimeSkillResolverProcessor,
    sourceConfidenceProcessor,
    recencyCheckProcessor,
    contradictionCheckProcessor,
    challengeClaimProcessor,
    technicalToolSearch,
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
