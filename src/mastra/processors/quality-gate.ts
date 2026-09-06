import type {
  Processor,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';

const MINIMUM_TEXT_LENGTH = 20;
const MAX_RETRIES = 2;

function looksIncomplete(text: string): boolean {
  return /\b(todo|still need to|unable to complete|ran out of steps|research is incomplete)\b/i.test(
    text,
  );
}

export class QualityGateProcessor implements Processor {
  readonly id = 'quality-gate';
  readonly name = 'Quality Gate';

  async processOutputResult({
    result,
    messageList,
    abort,
    retryCount,
  }: ProcessOutputResultArgs) {
    const text = result.text?.trim() ?? '';

    const problems: string[] = [];

    if (text.length < MINIMUM_TEXT_LENGTH) {
      problems.push(
        'The answer is empty or too short to meaningfully satisfy the request.',
      );
    }

    if (looksIncomplete(text)) {
      problems.push(
        'The answer appears to leave important work unfinished.',
      );
    }

    if (problems.length === 0) {
      return messageList;
    }

    if (retryCount < MAX_RETRIES) {
      abort(
        `
QUALITY GATE FAILED

${problems.map((problem) => `- ${problem}`).join('\n')}

Correct the response before returning it.

Check:
- the user's actual objective
- current task state
- working memory
- completed work
- pending important work
- requested output
- evidence quality
- contradictions
- uncertainty

Do not restart completed research.

Do not force the request into an unrelated research category.

Finish important remaining work when possible.

Return the strongest complete answer supported by available evidence.
`,
        {
          retry: true,
          metadata: {
            problems,
          },
        },
      );
    }

    return messageList;
  }
}

export const qualityGateProcessor =
  new QualityGateProcessor();