import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

import { pilotConfig } from '../config';

export class SourceDiversityProcessor
  implements Processor
{
  readonly id =
    'source-diversity';

  readonly name =
    'Source Diversity';

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const every =
      pilotConfig.research
        .sourceDiversityEvery;

    if (
      stepNumber < 3 ||
      stepNumber % every !== 0
    ) {
      return {};
    }

    return {
      systemMessages: [
        {
          role: 'system',

          content: `
SOURCE DIVERSITY

Review whether important conclusions rely on genuinely independent evidence.

Do not mistake multiple pages repeating the same source for independent corroboration.

Possible dependence includes:
- syndication
- copied articles
- search snippets from the same page
- aggregators reproducing primary data
- several pages citing the same announcement
- mirrors
- duplicated job listings
- duplicated press releases

For important claims prefer a useful combination of:
- primary source
- independent authoritative source
- independent corroborating source

Source diversity matters most when:
- the claim is important
- evidence is disputed
- identity is uncertain
- the information is current
- the user may make a decision from the result

Do not artificially collect extra sources when one authoritative primary source is sufficient.

When several apparent sources are dependent:
- treat them as one evidence family
- do not increase confidence merely because the same information appears repeatedly

When important claims lack sufficient independent evidence:
- seek another evidence family if doing so has meaningful expected value
- otherwise preserve appropriate uncertainty

Do not sacrifice source quality merely to increase source count.
`,
        },
      ],
    };
  }
}

export const sourceDiversityProcessor =
  new SourceDiversityProcessor();