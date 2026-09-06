import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

import { pilotConfig } from '../config';

export class SourceConfidenceProcessor
  implements Processor
{
  readonly id =
    'source-confidence';

  readonly name =
    'Source Confidence';

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const every =
      pilotConfig.research
        .sourceConfidenceEvery;

    if (
      stepNumber < 1 ||
      stepNumber % every !== 0
    ) {
      return {};
    }

    return {
      systemMessages: [
        {
          role: 'system',

          content: `
SOURCE CONFIDENCE

Evaluate important evidence according to the current task.

Do not assume the task is commercial, technical, people, company, or job research.

Prioritize:

1. official / primary sources
2. authoritative specialist sources
3. reputable secondary sources
4. directories / aggregators
5. search snippets

For important claims evaluate:

- authority
- directness
- recency
- corroboration
- identity certainty
- whether the source actually supports the claim

Confidence:

HIGH
Primary evidence or multiple strong independent sources agree.

MEDIUM
Credible evidence exists but is indirect, incomplete, or only partially corroborated.

LOW
Evidence is weak, stale, ambiguous, conflicting, or poorly corroborated.

Do not present LOW-confidence inference as fact.

For time-sensitive claims verify recency.

For identity claims verify entity matching.

For technical claims verify current versions and primary documentation.

For public contact information verify that the information is explicitly published.

Preserve useful evidence URLs with important findings.
`,
        },
      ],
    };
  }
}

export const sourceConfidenceProcessor =
  new SourceConfidenceProcessor();