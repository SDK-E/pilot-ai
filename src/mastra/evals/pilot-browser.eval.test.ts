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
  answerRelevancyScorer,
  completenessScorer,
  sourceCoverageScorer,
  taskCompletionScorer,
} from '../scorers';

import {
  runPilotEvals,
} from './run-with-memory';

import {
  assertEvalEnvironment,
} from './test-env';

const basicResearchData = [
  {
    input:
      'What is Mastra Observational Memory? Use current official sources and keep the answer concise.',
  },

  {
    input:
      'What are Mastra Experiments used for? Use current official sources and keep the answer concise.',
  },
];

describe(
  'Pilot Browser regression gates',
  () => {
    beforeAll(() => {
      assertEvalEnvironment();
    });

    it(
      'returns usable research without tool errors',
      async () => {
        const result =
          await runPilotEvals({
            data:
              basicResearchData,

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

    it(
      'uses web research tools',
      async () => {
        const result =
          await runPilotEvals({
            data: [
              {
                input:
                  'Research the current Mastra Experiments API using current public sources.',
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
      'meets minimum quality thresholds',
      async () => {
        const result =
          await runPilotEvals({
            data:
              basicResearchData,

            scorers: [
              {
                scorer:
                  answerRelevancyScorer,

                threshold: 0.65,
              },

              {
                scorer:
                  completenessScorer,

                threshold: 0.65,
              },

              {
                scorer:
                  sourceCoverageScorer,

                threshold: 0.5,
              },

              {
                scorer:
                  taskCompletionScorer,

                threshold: 0.75,
              },
            ],
          });

        expect(
          result.verdict,
        ).not.toBe(
          'failed',
        );
      },
      20 * 60 * 1000,
    );
  },
);