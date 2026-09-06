import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from '@mastra/core/processors';

function getLastUserText(
  messages: ProcessInputArgs['messages'],
): string {
  const message = [...messages]
    .reverse()
    .find((item) => item.role === 'user');

  if (!message) {
    return '';
  }

  return (
    message.content.parts
      ?.filter((part) => part.type === 'text')
      .map((part) =>
        'text' in part ? part.text : '',
      )
      .join('\n')
      .trim() ||
    message.content.content ||
    ''
  );
}

export class StaleObjectiveResetProcessor
  implements Processor
{
  readonly id = 'stale-objective-reset';
  readonly name = 'Stale Objective Reset';

  async processInput({
    messages,
    messageList,
  }: ProcessInputArgs): Promise<ProcessInputResult> {
    const currentRequest =
      getLastUserText(messages);

    if (!currentRequest) {
      return messageList;
    }

    messageList.addSystem(
      `
<OBJECTIVE_CONTINUITY_CHECK>

Current user message:

${currentRequest}

Before reusing persistent thread state, determine whether this message:

A. continues the existing objective
B. modifies the existing objective
C. creates a new unrelated objective

CONTINUATION

If it continues the existing objective:
- preserve relevant context
- preserve relevant state
- continue unfinished work
- do not restart completed work

MODIFICATION

If it modifies the existing objective:
- preserve still-relevant findings
- update constraints
- update requested output
- cancel or remove obsolete pending work
- keep completed evidence that remains useful

NEW OBJECTIVE

If it is a genuinely unrelated objective:
- do not let stale state bias the new task
- update current objective
- clear stale in-progress entries
- clear obsolete pending entries
- clear obsolete blocked entries
- preserve user context that remains generally relevant
- preserve prior thread history for semantic recall
- do not delete historical conversation memory

Do not reset state merely because the user's wording changed.

Reset only when the intended objective materially changed.

</OBJECTIVE_CONTINUITY_CHECK>
`,
      'stale-objective-reset',
    );

    return messageList;
  }
}

export const staleObjectiveResetProcessor =
  new StaleObjectiveResetProcessor();
