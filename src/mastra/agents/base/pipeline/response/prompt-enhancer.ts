import { Agent } from "@mastra/core/agent";

import { logger } from "../../../../logger.js";
import { latestUserText } from "../latest-user-text.js";

import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from "@mastra/core/processors";

/**
 * Requests longer than this already carry their own detail; enhancing them
 * costs a model call for little gain.
 */
const MAX_ENHANCED_REQUEST_LENGTH = 500;

const promptEnhancerAgent = new Agent({
  id: "pilot-prompt-enhancer",

  name: "Pilot Prompt Enhancer",

  model: [
    {
      // This step is optional and already fails open (executionBrief()
      // returns undefined and the turn proceeds without it), but it still
      // runs synchronously before the main agent call that the user is
      // actually waiting on. A retry budget above the main agent's own
      // (baseAgentLimits.maxRetries) would let a best-effort step add more
      // latency to every short message than the response itself gets.
      model: "kilo/kilo-auto/free",
      maxRetries: 2,
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

async function executionBrief(request: string): Promise<string | undefined> {
  try {
    const result = await promptEnhancerAgent.generate(`
User request:

${request}

Create the internal execution brief.
`);
    return result.text.trim() || undefined;
  } catch (error) {
    logger.warn("Prompt enhancement failed; continuing without a brief.", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return undefined;
  }
}

export class PromptEnhancerProcessor implements Processor {
  readonly id = "prompt-enhancer";
  readonly name = "Prompt Enhancer";

  async processInput({
    messages,
    messageList,
  }: ProcessInputArgs): Promise<ProcessInputResult> {
    const request = latestUserText(messages);
    if (!request || request.length > MAX_ENHANCED_REQUEST_LENGTH) {
      return messageList;
    }
    const brief = await executionBrief(request);
    if (!brief) return messageList;

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
    return messageList;
  }
}

export const promptEnhancerProcessor = new PromptEnhancerProcessor();
