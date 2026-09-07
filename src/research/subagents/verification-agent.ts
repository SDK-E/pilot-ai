import { pilotConfig } from '#runtime/research/config';
import { createBaseAgent } from '#runtime/agent/base-agent';
import { buildBaseAgentInstructions } from '#runtime/agent/base-instructions';

import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  entityResolutionProcessor,
  recencyCheckProcessor,
  runtimeSkillResolverProcessor,
  sourceConfidenceProcessor,
  sourceDiversityProcessor,
} from '#runtime/research/processors';
import { queryPlanner } from '#runtime/tools/query-planner';
import { researchScratchpad } from '#runtime/tools/research-scratchpad';
import { resultCollector } from '#runtime/tools/result-collector';
import { searchDorks } from '#runtime/tools/search/search-dorks';
import { skillsMarketplace } from '#runtime/research/tools/skills-marketplace';
import { stagehandBrowser } from '#runtime/research/tools/stagehand-browser';
import { webSearch } from '#runtime/tools/search/web-search';
import { createResearchToolSearchProcessor } from '../tool-search';
import { verificationAgentIdentity } from './identity';

const verificationToolSearch = createResearchToolSearchProcessor();

export const verificationAgent = createBaseAgent({
  base: {
    maxSteps: pilotConfig.agent.subagent.maxSteps,
    tokenLimit: pilotConfig.agent.subagent.tokenLimit,
    warningAt: pilotConfig.agent.subagent.stepBudget.warningAt,
    finalAt: pilotConfig.agent.subagent.stepBudget.finalAt,
  },
  id: 'pilot-research-verification',
  name: verificationAgentIdentity.name,
  description: verificationAgentIdentity.jobDescription,

  instructions: [
    buildBaseAgentInstructions(verificationAgentIdentity),
    `
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
    entityResolutionProcessor,
    sourceDiversityProcessor,
    challengeClaimProcessor,
    verificationToolSearch,
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
