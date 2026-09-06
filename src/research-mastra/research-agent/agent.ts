import { Agent } from '@mastra/core/agent';
import {
  TokenLimiterProcessor,
  ToolSearchProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';
import { TaskSignalProvider } from '@mastra/core/signals';
import { askUserTool } from '@mastra/core/tools';

import { pilotConfig } from './config';

import { coreInstructions } from './instructions/core';
import { completionInstructions } from './instructions/completion';
import { researchPlanningInstructions } from './instructions/research-planning';
import { toolUsageInstructions } from './instructions/tool-usage';
import { verificationInstructions } from './instructions/verification';
import { orgContext } from '../instructions/org-context';

import { pilotResearchMemory } from './memory/memory';

import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  currentContextProcessor,
  entityResolutionProcessor,
  failureRecoveryProcessor,
  memoryHygieneProcessor,
  negativeClaimVerificationProcessor,
  promptEnhancerProcessor,
  recencyCheckProcessor,
  researchBudgetProcessor,
  researchPolicyProcessor,
  runtimeSkillResolverProcessor,
  sourceConfidenceProcessor,
  sourceDiversityProcessor,
  staleObjectiveResetProcessor,
  stepBudgetProcessor,
  taskDependencyProcessor,
} from '../processors';

import {
  processNarrationGateProcessor,
  qualityGateProcessor,
  responseVerbosityProcessor,
} from '../../pilot-runtime/processors';

import {
  discoveryAgent,
  technicalAgent,
  verificationAgent,
} from './subagents';

import { bulkUrlFetch } from '../tools/bulk-url-fetch';
import { csvFile } from '../tools/csv-file';
import { domainIntelligence } from '../tools/domain-intelligence';
import { exportResults } from '../tools/export-results';
import { exportValidator } from '../tools/export-validator';
import { githubPublic } from '../tools/github-public';
import { markdownFile } from '../tools/markdown-file';
import { queryPlanner } from '../tools/query-planner';
import { researchScratchpad } from '../tools/research-scratchpad';
import { resultCollector } from '../tools/result-collector';
import { searchDorks } from '../tools/search-dorks';
import { siteDiscovery } from '../tools/site-discovery';
import { skillsMarketplace } from '../tools/skills-marketplace';
import { stagehandBrowser } from '../tools/stagehand-browser';
import { structuredData } from '../tools/structured-data';
import { webSearch } from '../tools/web-search';

const toolSearchProcessor =
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

export const pilotResearchAgent =
  new Agent({
    id: 'pilot-research',

    name: 'Pilot Research Agent',

    description:
      'General-purpose internet research agent. Researches public topics, entities, companies, people, technologies, repositories, markets, products, events, jobs, documents, claims, and questions using the web.',

    instructions: [
      coreInstructions,
      researchPlanningInstructions,
      toolUsageInstructions,
      verificationInstructions,
      completionInstructions,
      orgContext,
    ].join('\n\n'),

    model: [
      {
        model: pilotConfig.model.id,
        maxRetries: pilotConfig.model.maxRetries,
      },
    ],

    defaultOptions: {
      maxSteps: pilotConfig.agent.main.maxSteps,
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

          console.warn(
            `[pilot-research] delegation to ${primitiveId} failed`,
            error,
          );

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
      new UnicodeNormalizer({
        stripControlChars: true,
        collapseWhitespace: true,
      }),

      currentContextProcessor,
      staleObjectiveResetProcessor,
      promptEnhancerProcessor,
      researchPolicyProcessor,
      researchBudgetProcessor,
      responseVerbosityProcessor,
      runtimeSkillResolverProcessor,
      processNarrationGateProcessor,
      negativeClaimVerificationProcessor,
      qualityGateProcessor,
      taskDependencyProcessor,
      sourceConfidenceProcessor,
      entityResolutionProcessor,
      recencyCheckProcessor,
      contradictionCheckProcessor,
      sourceDiversityProcessor,
      challengeClaimProcessor,
      failureRecoveryProcessor,
      memoryHygieneProcessor,
      toolSearchProcessor,

      new TokenLimiterProcessor({
        limit: pilotConfig.agent.main.tokenLimit,
        strategy: 'truncate',
      }),

      stepBudgetProcessor,
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
