import { ToolSearchProcessor } from "@mastra/core/processors";
import { TaskSignalProvider } from "@mastra/core/signals";
import { askUserTool } from "@mastra/core/tools";

import { createBaseAgent } from "#runtime/agent/base-agent";
import { buildBaseAgentInstructions } from "#runtime/agent/base-instructions";
import { logger } from "#runtime/logger";
import { pilotConfig } from "#runtime/research-config";
import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  entityResolutionProcessor,
  memoryHygieneProcessor,
  negativeClaimVerificationProcessor,
  recencyCheckProcessor,
  researchBudgetProcessor,
  researchPolicyProcessor,
  runtimeSkillResolverProcessor,
  sourceConfidenceProcessor,
  sourceDiversityProcessor,
  taskDependencyProcessor,
} from "#runtime/research-processors";
import { githubPublic } from "#runtime/research-tools/github-public";
import { skillsMarketplace } from "#runtime/research-tools/skills-marketplace";
import { stagehandBrowser } from "#runtime/research-tools/stagehand-browser";
import { bulkUrlFetch } from "#runtime/tools/bulk-url-fetch";
import { csvFile } from "#runtime/tools/csv-file";
import { domainIntelligence } from "#runtime/tools/domain-intelligence";
import { exportResults } from "#runtime/tools/export-results";
import { exportValidator } from "#runtime/tools/export-validator";
import { markdownFile } from "#runtime/tools/markdown-file";
import { queryPlanner } from "#runtime/tools/query-planner";
import { researchScratchpad } from "#runtime/tools/research-scratchpad";
import { resultCollector } from "#runtime/tools/result-collector";
import { searchDorks } from "#runtime/tools/search/search-dorks";
import { webSearch } from "#runtime/tools/search/web-search";
import { siteDiscovery } from "#runtime/tools/site-discovery";
import { structuredData } from "#runtime/tools/structured-data";

import { researchAgentIdentity } from "./identity.js";
import { completionInstructions } from "./instructions/completion.js";
import { coreInstructions } from "./instructions/core.js";
import { orgContext } from "./instructions/org-context.js";
import { researchPlanningInstructions } from "./instructions/research-planning.js";
import { toolUsageInstructions } from "./instructions/tool-usage.js";
import { verificationInstructions } from "./instructions/verification.js";
import { pilotResearchMemory } from "./memory/memory.js";
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

export const pilotResearchAgent = createBaseAgent({
  base: {
    maxSteps: pilotConfig.agent.main.maxSteps,
    tokenLimit: pilotConfig.agent.main.tokenLimit,
    warningAt: pilotConfig.agent.main.stepBudget.warningAt,
    finalAt: pilotConfig.agent.main.stepBudget.finalAt,
  },
  id: "pilot-research",

  name: researchAgentIdentity.name,

  description: researchAgentIdentity.jobDescription,

  instructions: [
    buildBaseAgentInstructions(researchAgentIdentity),
    coreInstructions(researchAgentIdentity),
    researchPlanningInstructions,
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

  memory: pilotResearchMemory,

  signals: [new TaskSignalProvider()],

  agents: {
    discoveryAgent,
    verificationAgent,
    technicalAgent,
  },

  inputProcessors: [
    researchPolicyProcessor,
    researchBudgetProcessor,
    runtimeSkillResolverProcessor,
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
    researchScratchpad,
    resultCollector,
    askUserTool,
  },
});
