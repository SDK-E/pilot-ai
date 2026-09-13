import { createBaseAgent } from "../../agents/base/agent.js";
import { pilotConfig } from "../../agents/base/config/index.js";
import { buildBaseAgentInstructions } from "../../agents/base/instructions.js";
import {
  entityResolutionProcessor,
  recencyCheckProcessor,
  skillResolverProcessor,
  sourceDiversityProcessor,
} from "../../agents/base/processors/index.js";
import { stagehandBrowser } from "../../tools/browser/stagehand.js";
import { queryPlanner } from "../../tools/planning/query-planner.js";
import { resultCollector } from "../../tools/planning/result-collector.js";
import { workingNotes } from "../../tools/planning/working-notes.js";
import { searchDorks } from "../../tools/search/search-dorks.js";
import { webSearch } from "../../tools/search/web-search.js";
import { skillsMarketplace } from "../../tools/skills/marketplace.js";
import { createToolSearchProcessor } from "../tool-search.js";

import { discoveryAgentIdentity } from "./identity.js";

const discoveryToolSearch = createToolSearchProcessor();

export const discoveryAgent = createBaseAgent({
  base: {
    maxSteps: pilotConfig.agent.subagent.maxSteps,
    tokenLimit: pilotConfig.agent.subagent.tokenLimit,
    warningAt: pilotConfig.agent.subagent.stepBudget.warningAt,
    finalAt: pilotConfig.agent.subagent.stepBudget.finalAt,
  },
  id: "pilot-research-discovery",
  name: discoveryAgentIdentity.name,
  description: discoveryAgentIdentity.jobDescription,

  instructions: [
    buildBaseAgentInstructions(discoveryAgentIdentity),
    `
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
`.trim(),
  ].join("\n\n"),

  model: [
    {
      model: pilotConfig.model.id,
      maxRetries: pilotConfig.model.maxRetries,
    },
  ],

  inputProcessors: [
    skillResolverProcessor,
    recencyCheckProcessor,
    entityResolutionProcessor,
    sourceDiversityProcessor,
    discoveryToolSearch,
  ],

  tools: {
    queryPlanner,
    webSearch,
    searchDorks,
    stagehandBrowser,
    skillsMarketplace,
    workingNotes,
    resultCollector,
  },
});
