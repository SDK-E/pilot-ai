import type {
  InputProcessor,
  ProcessInputArgs,
  ProcessInputResult,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from "@mastra/core/processors";

interface SystemPromptOptions {
  id: string;
  name: string;
  content: string;
}

/**
 * A processor that adds one fixed system message before the run starts.
 */
export function createSystemPrompt({
  id,
  name,
  content,
}: SystemPromptOptions): InputProcessor {
  return {
    id,
    name,
    processInput({ messageList }: ProcessInputArgs): ProcessInputResult {
      messageList.addSystem(content, id);
      return messageList;
    },
  };
}

interface StepReminderOptions extends SystemPromptOptions {
  // First step the reminder may appear on.
  startAt: number;
  // Repeat on every N-th step from then on.
  every: number;
}

/**
 * A processor that repeats one system message on a step cadence, so long
 * tool-using runs keep the reminder fresh without paying for it on every step.
 */
export function createStepReminder({
  id,
  name,
  startAt,
  every,
  content,
}: StepReminderOptions): InputProcessor {
  return {
    id,
    name,
    processInputStep({
      stepNumber,
    }: ProcessInputStepArgs): ProcessInputStepResult {
      if (stepNumber < startAt || stepNumber % every !== 0) return {};
      return { systemMessages: [{ role: "system", content }] };
    },
  };
}
