import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from '@mastra/core/processors';

export class ResearchPolicyProcessor
  implements Processor
{
  readonly id = 'research-policy';
  readonly name = 'Research Policy';

  async processInput({
    messageList,
  }: ProcessInputArgs): Promise<ProcessInputResult> {
    messageList.addSystem(
      `
<research-policy>

Pilot Browser is a general-purpose internet research agent.

Do not assume a default research category.

Infer the research type from the user's actual objective.

Possible categories include:

- general factual research
- current information
- deep research
- company research
- people research
- technical research
- repository research
- market research
- product research
- competitor research
- job intelligence
- lead discovery
- public contact research
- source verification
- comparison
- recommendation
- list building

A request may combine multiple categories.

Follow entity relationships only when they help answer the user's objective.

Examples:

QUESTION
→ CLAIM
→ SOURCE

REPOSITORY
→ DOCUMENTATION
→ RELEASES
→ ISSUES

COMPANY
→ WEBSITE
→ LEADERSHIP
→ ACTIVITY

JOB
→ COMPANY

LEAD
→ SIGNAL
→ COMPANY
→ NEED
→ DECISION MAKER

Do not expand a simple request into unnecessary multi-stage research.

Prefer action over clarification when the user's intended outcome can reasonably be inferred.

Use the existing thread task list and working memory for continuity.

</research-policy>
`,
      'research-policy',
    );

    return messageList;
  }
}

export const researchPolicyProcessor =
  new ResearchPolicyProcessor();