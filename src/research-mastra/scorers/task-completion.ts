import { createScorer } from '@mastra/core/evals';

import {
  agentOutputToText,
} from './utils';

const incompletePatterns = [
  /\bstill need to\b/i,
  /\bneed to continue\b/i,
  /\bresearch is incomplete\b/i,
  /\bran out of steps\b/i,
  /\bunable to complete\b/i,
  /\bcould not finish\b/i,
  /\bnot completed\b/i,
];

export const taskCompletionScorer =
  createScorer({
    id: 'pilot-task-completion',

    name: 'Pilot Task Completion',

    description:
      'Checks whether Pilot returned a meaningful final answer without obvious unfinished-work indicators.',

    type: 'agent',
  })
    .analyze(({ run }) => {
      const text =
        agentOutputToText(
          run.output,
        ).trim();

      const incomplete =
        incompletePatterns.some(
          (pattern) =>
            pattern.test(text),
        );

      return {
        length: text.length,
        incomplete,
        empty: text.length === 0,
      };
    })

    .generateScore(
      ({ results }) => {
        const analysis =
          results.analyzeStepResult;

        if (analysis.empty) {
          return 0;
        }

        if (analysis.incomplete) {
          return 0.25;
        }

        if (
          analysis.length < 40
        ) {
          return 0.5;
        }

        return 1;
      },
    )

    .generateReason(
      ({
        score,
        results,
      }) => {
        const analysis =
          results.analyzeStepResult;

        if (analysis.empty) {
          return 'The agent returned no meaningful final response.';
        }

        if (analysis.incomplete) {
          return 'The final response contains an explicit indicator that important work remained unfinished.';
        }

        if (
          analysis.length < 40
        ) {
          return 'The response completed without an explicit failure marker, but the final answer is unusually short.';
        }

        return `The response appears complete and contains no obvious unfinished-work markers. Score: ${score}.`;
      },
    );