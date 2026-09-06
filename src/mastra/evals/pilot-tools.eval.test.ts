import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import {
  checks,
} from '@mastra/evals/checks';

import {
  runPilotEvals,
} from './run-with-memory';

import {
  assertEvalEnvironment,
} from './test-env';

describe(
  'Pilot Browser tool behavior',
  () => {
    beforeAll(() => {
      assertEvalEnvironment();
    });

    it(
      'uses search for broad discovery',
      async () => {
        const result =
          await runPilotEvals({
            data: [
              {
                input:
                  'Find three current official or authoritative sources explaining Mastra memory.',
              },
            ],

            gates: [
              checks.calledTool(
                'lang-search',
              ),

              checks.noToolErrors(),
            ],
          });

        expect(
          result.verdict,
        ).not.toBe(
          'failed',
        );
      },
      15 * 60 * 1000,
    );

    it(
      'recovers from a harmless failed source',
      async () => {
        const result =
          await runPilotEvals({
            data: [
              {
                input: `
Try to inspect this intentionally nonexistent public page once:

https://mastra.ai/docs/this-page-does-not-exist-pilot-test

Then recover using another valid Mastra source and explain what Mastra Experiments are.

Do not repeatedly retry the invalid URL.
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
      15 * 60 * 1000,
    );
  },
);