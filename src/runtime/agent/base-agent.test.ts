import { describe, expect, it } from 'vitest';

import { createBaseAgent } from './base-agent';

describe('createBaseAgent', () => {
  it('installs the shared reliability processors and bounded recovery', async () => {
    const agent = createBaseAgent({
      base: {
        maxSteps: 4,
        tokenLimit: 1_000,
        warningAt: 2,
        finalAt: 3,
      },
      id: 'base-agent-test',
      name: 'Base Agent Test',
      instructions: 'Be helpful.',
      model: 'kilo/kilo-auto/free',
      tools: {},
    });

    const processors = await agent.getConfiguredProcessorIds();

    expect(processors.inputProcessorIds).toEqual([
      'unicode-normalizer',
      'current-context',
      'stale-objective-reset',
      'response-verbosity',
      'process-narration-gate',
      'quality-gate',
      'failure-recovery',
      'token-limiter',
      'step-budget',
    ]);
    expect(processors.errorProcessorIds).toEqual([
      'prefill-error-handler',
    ]);
  });
});
