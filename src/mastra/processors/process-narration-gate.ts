import type {
  Processor,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';

const MAX_RETRIES = 1;

const PROCESS_NARRATION_PATTERNS = [
  /\blet me (?:now )?(?:finalize|synthesize|summarize|update|check|verify|search|fetch|research|inspect|record|continue)\b/i,
  /\bi(?:'ll| will) (?:now )?(?:finalize|synthesize|update|check|verify|search|fetch|research|inspect|record|continue)\b/i,
  /\bbefore (?:i )?(?:present|return|answer|finalize)\b/i,
  /\bnow (?:i )?(?:have|need to) everything needed\b/i,
  /\bi now have everything needed\b/i,
  /\bmy task list\b/i,
  /\bupdate my working memory\b/i,
  /\brecord (?:this|these|the findings) in working memory\b/i,
  /\bfinalize my task\b/i,
  /\bfinalize the task list\b/i,
  /\bsynthesize the findings\b/i,
  /\bi've gathered enough\b/i,
  /\bi have enough (?:information|evidence|sources)\b/i,
];

function containsProcessNarration(
  text: string,
): boolean {
  return PROCESS_NARRATION_PATTERNS.some(
    (pattern) =>
      pattern.test(text),
  );
}

export class ProcessNarrationGateProcessor
  implements Processor
{
  readonly id =
    'process-narration-gate';

  readonly name =
    'Process Narration Gate';

  async processOutputResult({
    result,
    messageList,
    abort,
    retryCount,
  }: ProcessOutputResultArgs) {
    const text =
      result.text?.trim() ?? '';

    if (
      !containsProcessNarration(
        text,
      )
    ) {
      return messageList;
    }

    if (
      retryCount >= MAX_RETRIES
    ) {
      return messageList;
    }

    abort(
      `
PROCESS NARRATION DETECTED

The proposed response exposes internal execution narration.

Do not tell the user what you are about to do, what you just did internally, or that you are updating memory, tasks, research state, or preparing the answer.

Remove phrases such as:
- "Let me..."
- "I'll now..."
- "I have everything needed..."
- "Before presenting..."
- "Let me update working memory..."
- "Let me finalize my task list..."
- descriptions of internal searching, checking, recording, synthesis, or state management

Return only the useful user-facing answer.

Internal tasks, working memory, processors, tool orchestration, research state, retries, and planning must remain invisible unless the user explicitly asks for execution details.
`,
      {
        retry: true,

        metadata: {
          reason:
            'process-narration-detected',
        },
      },
    );

    return messageList;
  }
}

export const processNarrationGateProcessor =
  new ProcessNarrationGateProcessor();