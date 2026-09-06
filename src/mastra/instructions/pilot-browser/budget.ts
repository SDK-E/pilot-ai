import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

export class StepBudgetProcessor implements Processor {
  readonly id = 'step-budget';
  readonly name = 'Step Budget';

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    if (stepNumber < 40) {
      return {};
    }

    if (stepNumber < 46) {
      return {
        systemMessages: [
          {
            role: 'system',
            content: `
Execution budget is becoming limited.

Do not begin weak new research branches.

Immediately:
- check the current task list
- finish high-value in-progress tasks
- mark completed tasks
- update working memory execution state
- resolve important pending verification
- deduplicate results
- prepare requested exports

Preserve continuation state for anything that cannot be completed.
`,
          },
        ],
      };
    }

    return {
      toolChoice: 'none',

      systemMessages: [
        {
          role: 'system',
          content: `
Execution budget is exhausted.

Do not call more tools.

Using current context:
- finalize the strongest available result
- accurately reflect incomplete work
- preserve continuation notes in the response context if possible
- do not claim pending tasks were completed
`,
        },
      ],
    };
  }
}

export const stepBudgetProcessor =
  new StepBudgetProcessor();