import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  checks,
} from '@mastra/evals/checks';

import { pilotConfig } from '../config';

import {
  runPilotEvals,
} from './run-with-memory';

import {
  assertEvalEnvironment,
} from './test-env';

const timeout =
  pilotConfig.eval.timeoutMs;

describe(
  'Pilot Research Agent delegation',
  () => {
    beforeAll(() => {
      assertEvalEnvironment();
    });

    it(
      'can delegate technical research',
      async () => {
        const result =
          await runPilotEvals({
            data: [
              {
                input: `
Research the current Mastra ToolSearchProcessor implementation.

This is a technical research task.

Delegate the repository/API investigation to the technical specialist when useful.

Return current evidence and source URLs.
`,
              },
            ],

            gates: [
              checks.noToolErrors(),
            ],
          });

        expect(
          result.verdict,
        ).not.toBe(
          'failed',
        );
      },
      timeout,
    );

    it(
      'can perform discovery plus verification',
      async () => {
        const result =
          await runPilotEvals({
            data: [
              {
                input: `
Find current public evidence about Mastra supervisor agents.

Use discovery for candidate sources.

Use verification to independently verify the strongest important claim.

Return the final claim, evidence, contradiction status, and confidence.
`,
              },
            ],

            gates: [
              checks.noToolErrors(),
            ],
          });

        expect(
          result.verdict,
        ).not.toBe(
          'failed',
        );
      },
      timeout,
    );
  },
);
