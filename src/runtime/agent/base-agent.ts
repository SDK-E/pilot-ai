import { Agent, type AgentConfig } from '@mastra/core/agent';
import {
  type ErrorProcessorOrWorkflow,
  type InputProcessorOrWorkflow,
  PrefillErrorHandler,
  TokenLimiterProcessor,
  UnicodeNormalizer,
} from '@mastra/core/processors';

import {
  currentContextProcessor,
  createStepBudgetProcessor,
  failureRecoveryProcessor,
  processNarrationGateProcessor,
  qualityGateProcessor,
  responseVerbosityProcessor,
  staleObjectiveResetProcessor,
} from '../processors/index.js';

type BaseAgentLimits = {
  maxSteps: number;
  tokenLimit: number;
  warningAt: number;
  finalAt: number;
};

type BaseAgentConfig = Omit<
  AgentConfig,
  'inputProcessors' | 'errorProcessors'
> & {
  base: BaseAgentLimits;
  inputProcessors?: InputProcessorOrWorkflow[];
  errorProcessors?: ErrorProcessorOrWorkflow[];
};

/**
 * Creates an agent with Pilot's common reliability and response-quality
 * pipeline. Agent modules add their own tools, memory, and specialist
 * processors; this factory keeps the shared behavior explicit and consistent.
 */
export function createBaseAgent({
  base,
  inputProcessors = [],
  errorProcessors = [],
  defaultOptions,
  ...agentConfig
}: BaseAgentConfig): Agent {
  return new Agent({
    ...agentConfig,
    defaultOptions: {
      ...defaultOptions,
      maxSteps: base.maxSteps,
    },
    maxProcessorRetries: 2,
    inputProcessors: [
      new UnicodeNormalizer({
        stripControlChars: true,
        collapseWhitespace: true,
      }),
      currentContextProcessor,
      staleObjectiveResetProcessor,
      responseVerbosityProcessor,
      processNarrationGateProcessor,
      qualityGateProcessor,
      failureRecoveryProcessor,
      ...inputProcessors,
      new TokenLimiterProcessor({
        limit: base.tokenLimit,
        strategy: 'truncate',
      }),
      createStepBudgetProcessor(base),
    ],
    errorProcessors: [new PrefillErrorHandler(), ...errorProcessors],
  });
}
