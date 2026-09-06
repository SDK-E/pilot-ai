import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

export class RecencyCheckProcessor implements Processor {
  readonly id = 'recency-check';
  readonly name = 'Recency Check';

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
RECENCY CHECK

Determine whether important information gathered so far is time-sensitive.

Examples include:
- current events
- news
- current employment
- leadership
- active jobs
- product availability
- pricing
- software versions
- releases
- APIs
- regulations
- schedules
- events
- company initiatives
- market information
- public contact information

For time-sensitive claims check when useful:
- publication date
- update date
- observed date
- active/inactive status
- whether a newer primary source exists
- whether another source contradicts the current state

Do not treat an old source as current simply because the page is still online.

Prefer:
current primary evidence
→ recent authoritative evidence
→ older evidence only when still demonstrably valid

When freshness cannot be verified:
- lower confidence when it matters
- preserve the observed date when known
- communicate uncertainty when relevant

Do not waste research steps checking recency for timeless facts.

If stale information is replaced:
- update working memory
- update collected results
- preserve the stronger current evidence
- remove obsolete state when appropriate
`,
        },
      ],
    };
  }
}

export const recencyCheckProcessor =
  new RecencyCheckProcessor();