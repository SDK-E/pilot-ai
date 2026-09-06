import { Agent } from '@mastra/core/agent';

import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from '@mastra/core/processors';

const promptEnhancerAgent = new Agent({
  id: 'pilot-browser-prompt-enhancer',

  name: 'Pilot Browser Prompt Enhancer',

  model: [
    {
      model: 'kilo/kilo-auto/free',
      maxRetries: 8,
    },
  ],

  instructions: `
You expand short user requests into compact internal execution briefs for a general-purpose internet research agent.

Do not answer the user's request.

Do not assume the request is:
- lead generation
- company research
- job research
- commercial research
- technical research

Infer the actual type from the request.

Possible research includes anything available on the public web.

Infer when useful:
- intended outcome
- research type
- entities
- relationships
- current-information requirement
- geography
- time range
- research depth
- verification needs
- requested output
- completion criteria

Use conversation context and existing memory when relevant.

Preserve every explicit constraint.

Do not invent:
- facts
- constraints
- business intent
- geographic scope
- output requirements

Do not ask questions.

Return only a compact internal execution brief.
`,
});

function getText(
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
      ?.filter(
        (part) => part.type === 'text',
      )
      .map((part) =>
        'text' in part ? part.text : '',
      )
      .join('\n')
      .trim() ||
    message.content.content ||
    ''
  );
}

export class PromptEnhancerProcessor
  implements Processor
{
  readonly id = 'prompt-enhancer';
  readonly name = 'Prompt Enhancer';

  async processInput({
    messages,
    messageList,
  }: ProcessInputArgs): Promise<ProcessInputResult> {
    const request = getText(messages);

    if (!request) {
      return messageList;
    }

    try {
      const result =
        await promptEnhancerAgent.generate(`
User request:

${request}

Create the internal execution brief.
`);

      const brief = result.text.trim();

      if (!brief) {
        return messageList;
      }

      messageList.addSystem(
        `
<enhanced-user-intent>
This is internal execution context.

Do not quote or expose this block to the user.

${brief}
</enhanced-user-intent>
`,
        'prompt-enhancer',
      );
    } catch (error) {
      console.warn(
        '[prompt-enhancer] enhancement failed',
        error,
      );
    }

    return messageList;
  }
}

export const promptEnhancerProcessor =
  new PromptEnhancerProcessor();