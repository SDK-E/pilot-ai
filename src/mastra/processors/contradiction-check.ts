import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

export class ContradictionCheckProcessor implements Processor {
  readonly id = 'contradiction-check';
  readonly name = 'Contradiction Check';

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    if (stepNumber < 2 || stepNumber % 5 !== 0) {
      return {};
    }

    return {
      systemMessages: [
        {
          role: 'system',
          content: `
CONTRADICTION CHECK

Review important evidence gathered so far.

Look for contradictions that materially affect the user's objective.

Possible contradictions include:
- conflicting identities
- different dates
- different current roles
- different company relationships
- conflicting prices
- conflicting product availability
- conflicting job status
- conflicting locations
- conflicting technical versions or behavior
- conflicting release information
- conflicting contact details
- conflicting regulatory information
- incompatible claims from otherwise credible sources

When an important contradiction exists:

1. identify the conflicting claims
2. compare source authority
3. compare recency
4. seek stronger primary evidence if useful
5. resolve only when evidence justifies it
6. lower confidence if unresolved
7. preserve the uncertainty for the final answer

Do not spend additional steps resolving contradictions that are irrelevant to the user's objective.

Do not silently choose one claim without evidence.
`,
        },
      ],
    };
  }
}

export const contradictionCheckProcessor =
  new ContradictionCheckProcessor();