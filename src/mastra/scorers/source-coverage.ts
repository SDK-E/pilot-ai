import { createScorer } from '@mastra/core/evals';

import {
  agentOutputToText,
  uniqueUrls,
} from './utils';

export const sourceCoverageScorer =
  createScorer({
    id: 'pilot-source-coverage',

    name: 'Pilot Source Coverage',

    description:
      'Measures whether a research-style Pilot response contains useful source URLs and source diversity.',

    type: 'agent',
  })
    .analyze(({ run }) => {
      const text =
        agentOutputToText(
          run.output,
        );

      const urls =
        uniqueUrls(text);

      const domains = [
        ...new Set(
          urls.flatMap((value) => {
            try {
              return [
                new URL(
                  value,
                ).hostname.replace(
                  /^www\./,
                  '',
                ),
              ];
            } catch {
              return [];
            }
          }),
        ),
      ];

      return {
        urlCount: urls.length,
        domainCount:
          domains.length,
      };
    })

    .generateScore(
      ({ results }) => {
        const {
          urlCount,
          domainCount,
        } =
          results.analyzeStepResult;

        if (urlCount === 0) {
          return 0;
        }

        if (
          urlCount === 1
        ) {
          return 0.4;
        }

        if (
          domainCount === 1
        ) {
          return 0.6;
        }

        if (
          domainCount === 2
        ) {
          return 0.8;
        }

        return 1;
      },
    )

    .generateReason(
      ({ results }) => {
        const {
          urlCount,
          domainCount,
        } =
          results.analyzeStepResult;

        return `${urlCount} unique source URLs across ${domainCount} unique domains were present in the final response.`;
      },
    );