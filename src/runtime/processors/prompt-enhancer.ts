import { Agent } from "@mastra/core/agent";

import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from "@mastra/core/processors";

const promptEnhancerAgent = new Agent({
  id: "pilot-prompt-enhancer",

  name: "Pilot Prompt Enhancer",

  model: [
    {
      model: "kilo/kilo-auto/free",
      maxRetries: 8,
    },
  ],

  instructions: `
You expand short user requests into compact internal execution briefs for a capable general-purpose assistant.

Do not answer the user. Do not add facts, constraints, or goals.

Preserve every explicit request and infer only the operational details that are strongly supported:
- intended outcome and completion criteria
- relevant entities and constraints
- whether current information or evidence is required
- requested format, tone, and level of detail
- whether the request needs a clarification before irreversible work

Use conversation context when relevant. Return only a compact internal brief.
`,
});

function getText(messages: ProcessInputArgs["messages"]): string {
  const message = [...messages].reverse().find((item) => item.role === "user");

  if (!message) {
    return "";
  }

  return (
    message.content.parts
      ?.filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join("\n")
      .trim() ||
    message.content.content ||
    ""
  );
}

export class PromptEnhancerProcessor implements Processor {
  readonly id = "prompt-enhancer";
  readonly name = "Prompt Enhancer";

  async processInput({
    messages,
    messageList,
  }: ProcessInputArgs): Promise<ProcessInputResult> {
    const request = getText(messages);

    if (!request) {
      return messageList;
    }

    try {
      if (request.length > 500) return messageList;

      const result = await promptEnhancerAgent.generate(`
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
        "prompt-enhancer",
      );
    } catch (error) {
      console.warn("[prompt-enhancer] enhancement failed", error);
    }

    return messageList;
  }
}

export const promptEnhancerProcessor = new PromptEnhancerProcessor();
