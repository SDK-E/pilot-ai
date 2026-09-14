import { ToolSearchProcessor } from "@mastra/core/processors";
import { TaskSignalProvider } from "@mastra/core/signals";
import { askUserTool } from "@mastra/core/tools";

import { createBaseAgent } from "../agents/base/agent.js";
import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  entityResolutionProcessor,
  memoryHygieneProcessor,
  negativeClaimVerificationProcessor,
  recencyCheckProcessor,
  runBudgetProcessor,
  toolPolicyProcessor,
  skillResolverProcessor,
  sourceConfidenceProcessor,
  sourceDiversityProcessor,
  taskDependencyProcessor,
} from "../agents/base/pipeline/index.js";
import { pilotConfig } from "../agents/base/profiles/index.js";
import { buildBaseAgentInstructions } from "../agents/base/shared-instructions.js";
import { logger } from "../logger.js";
import { stagehandBrowser } from "../tools/browser/stagehand.js";
import { githubPublic } from "../tools/code/github-public.js";
import { csvFile } from "../tools/files/csv-file.js";
import { exportResults } from "../tools/files/export-results.js";
import { exportValidator } from "../tools/files/export-validator.js";
import { markdownFile } from "../tools/files/markdown-file.js";
import { structuredData } from "../tools/files/structured-data.js";
import { queryPlanner } from "../tools/planning/query-planner.js";
import { resultCollector } from "../tools/planning/result-collector.js";
import { workingNotes } from "../tools/planning/working-notes.js";
import { searchDorks } from "../tools/search/search-dorks.js";
import { webSearch } from "../tools/search/web-search.js";
import { skillsMarketplace } from "../tools/skills/marketplace.js";
import { bulkUrlFetch } from "../tools/web/bulk-url-fetch.js";
import { domainIntelligence } from "../tools/web/domain-intelligence.js";
import { siteDiscovery } from "../tools/web/site-discovery.js";

import { developmentAgentIdentity } from "./identity.js";
import { completionInstructions } from "./instructions/completion.js";
import { coreInstructions } from "./instructions/core.js";
import { orgContext } from "./instructions/org-context.js";
import { planningInstructions } from "./instructions/planning.js";
import { toolUsageInstructions } from "./instructions/tool-usage.js";
import { verificationInstructions } from "./instructions/verification.js";
import { developmentMemory } from "./memory/memory.js";
import {
  discoveryAgent,
  technicalAgent,
  verificationAgent,
} from "./subagents/index.js";

const toolSearchProcessor = new ToolSearchProcessor({
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
  storage: "context",
});

export const developmentAgent = createBaseAgent({
  base: {
    maxSteps: pilotConfig.agent.main.maxSteps,
    tokenLimit: pilotConfig.agent.main.tokenLimit,
    warningAt: pilotConfig.agent.main.stepBudget.warningAt,
    finalAt: pilotConfig.agent.main.stepBudget.finalAt,
  },
  id: "pilot-development",

  name: developmentAgentIdentity.name,

  description: developmentAgentIdentity.jobDescription,

  instructions: [
    buildBaseAgentInstructions(developmentAgentIdentity),
    coreInstructions(developmentAgentIdentity),
    planningInstructions,
    toolUsageInstructions,
    verificationInstructions,
    completionInstructions,
    orgContext,
  ].join("\n\n"),

  model: [
    {
      model: pilotConfig.model.id,
      maxRetries: pilotConfig.model.maxRetries,
    },
  ],

  defaultOptions: {
    autoResumeSuspendedTools: true,

    delegation: {
      messageFilter: ({ messages }) => messages.slice(-12),

      onDelegationStart: async ({ prompt }) => ({
        proceed: true,
        modifiedPrompt: `
${prompt}

Stay strictly within the delegated objective.
Return concise findings and evidence.
Do not broaden into unrelated research.
Current time: ${new Date().toISOString()}
`,
      }),

      onDelegationComplete: async ({ primitiveId, error }) => {
        if (!error) return;

        logger.warn("Delegated branch failed; asking the parent to recover.", {
          primitiveId,
          errorName: error instanceof Error ? error.name : "unknown",
        });

        return {
          feedback: `
The delegated branch failed.
Recover using another useful evidence path.
Do not abandon the parent objective.
`,
        };
      },
    },
  },

  memory: developmentMemory,

  signals: [new TaskSignalProvider()],

  agents: {
    discoveryAgent,
    verificationAgent,
    technicalAgent,
  },

  inputProcessors: [
    toolPolicyProcessor,
    runBudgetProcessor,
    skillResolverProcessor,
    negativeClaimVerificationProcessor,
    taskDependencyProcessor,
    sourceConfidenceProcessor,
    entityResolutionProcessor,
    recencyCheckProcessor,
    contradictionCheckProcessor,
    sourceDiversityProcessor,
    challengeClaimProcessor,
    memoryHygieneProcessor,
    toolSearchProcessor,
  ],

  outputProcessors: [],

  tools: {
    queryPlanner,
    webSearch,
    searchDorks,
    stagehandBrowser,
    skillsMarketplace,
    workingNotes,
    resultCollector,
    askUserTool,
  },
});
