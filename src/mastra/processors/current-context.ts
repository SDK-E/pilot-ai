import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from '@mastra/core/processors';

export class CurrentContextProcessor implements Processor {
  readonly id = 'current-context';
  readonly name = 'Current Context';

  async processInput({
    messageList,
  }: ProcessInputArgs): Promise<ProcessInputResult> {
    const now = new Date();

    messageList.addSystem(
      `
<CURRENT_CONTEXT>
Current date and time: ${now.toISOString()}
Unix timestamp: ${now.getTime()}
</CURRENT_CONTEXT>
`,
      'current-context',
    );

    return messageList;
  }
}

export const currentContextProcessor =
  new CurrentContextProcessor();