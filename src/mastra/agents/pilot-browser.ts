import { Agent } from '@mastra/core/agent';
import {
  TokenLimiterProcessor,
  ToolSearchProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';
import { TaskSignalProvider } from '@mastra/core/signals';
import {
  askUserTool,
  webFetchTool,
} from '@mastra/core/tools';

import { pilotConfig } from '../config';

import { coreInstructions } from '../instructions/pilot-browser/core';
import { completionInstructions } from '../instructions/pilot-browser/completion';
import { researchPlanningInstructions } from '../instructions/pilot-browser/research-planning';
import { toolUsageInstructions } from '../instructions/pilot-browser/tool-usage';
import { verificationInstructions } from '../instructions/pilot-browser/verification';
import { orgContext } from '../instructions/org-context';

import { pilotBrowserMemory } from '../memory/pilot-browser-memory';

import {
  challengeClaimProcessor,
  contradictionCheckProcessor,
  currentContextProcessor,
  entityResolutionProcessor,
  failureRecoveryProcessor,
  memoryHygieneProcessor,
  negativeClaimVerificationProcessor,
  processNarrationGateProcessor,
  promptEnhancerProcessor,
  qualityGateProcessor,
  recencyCheckProcessor,
  researchBudgetProcessor,
  researchPolicyProcessor,
  responseVerbosityProcessor,
  sourceConfidenceProcessor,
  sourceDiversityProcessor,
  staleObjectiveResetProcessor,
  stepBudgetProcessor,
  taskDependencyProcessor,
} from '../processors';

import {
  discoveryAgent,
  technicalAgent,
  verificationAgent,
} from './subagents';

import { bulkUrlFetch } from '../tools/bulk-url-fetch';
import { domainIntelligence } from '../tools/domain-intelligence';
import { exportResults } from '../tools/export-results';
import { exportValidator } from '../tools/export-validator';
import { githubPublic } from '../tools/github-public';
import { langSearch } from '../tools/langsearch';
import { researchScratchpad } from '../tools/research-scratchpad';
import { resultCollector } from '../tools/result-collector';
import { siteDiscovery } from '../tools/site-discovery';
import { stagehandBrowser } from '../tools/stagehand-browser';
import { structuredData } from '../tools/structured-data';

const toolSearchProcessor =
  new ToolSearchProcessor({
    tools: {
      bulkUrlFetch,
      domainIntelligence,
      githubPublic,
      siteDiscovery,
      structuredData,
    },

    search: {
      topK: 4,
      minScore: 0.1,
    },

    ttl: 3_600_000,
  });

export const pilotBrowser =
  new Agent({
    id: 'pilot-browser',

    name: 'Pilot Browser',

    description:
      'General-purpose internet research and browsing agent. Researches any public topic, entity, company, person, technology, repository, market, product, event, job, lead, document, claim, or question using the web.',

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
        model:
          pilotConfig.model.id,

        maxRetries:
          pilotConfig.model
            .maxRetries,
      },
    ],

    defaultOptions: {
      maxSteps:
        pilotConfig.agent.main
          .maxSteps,

      delegation: {
        messageFilter: ({
          messages,
        }) =>
          messages.slice(-12),

        onDelegationStart:
          async ({
            prompt,
          }) => ({
            proceed: true,

            modifiedPrompt: `
${prompt}

Stay strictly within the delegated objective.

Return concise findings and evidence.

Do not broaden into unrelated research.

Current time: ${new Date().toISOString()}
`,
          }),

        onDelegationComplete:
          async ({
            primitiveId,
            error,
          }) => {
            if (!error) {
              return;
            }

            console.warn(
              `[pilot-browser] delegation to ${primitiveId} failed`,
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

    memory:
      pilotBrowserMemory,

    signals: [
      new TaskSignalProvider(),
    ],

    agents: {
      discoveryAgent,
      verificationAgent,
      technicalAgent,
    },

    inputProcessors: [
      new UnicodeNormalizer({
        stripControlChars:
          true,

        collapseWhitespace:
          true,
      }),

      currentContextProcessor,
      staleObjectiveResetProcessor,

      promptEnhancerProcessor,

      researchPolicyProcessor,
      researchBudgetProcessor,
      responseVerbosityProcessor,

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
        limit:
          pilotConfig.agent.main
            .tokenLimit,

        strategy:
          'truncate',
      }),

      stepBudgetProcessor,
    ],

    outputProcessors: [],

    tools: {
      langSearch,
      webFetchTool,
      stagehandBrowser,

      researchScratchpad,
      resultCollector,

      exportValidator,
      exportResults,

      askUserTool,
    },
  });