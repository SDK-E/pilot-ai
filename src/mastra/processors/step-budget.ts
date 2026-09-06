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
    if (stepNumber < 150) {
      return {};
    }

    if (stepNumber < 170) {
      return {
        systemMessages: [
          {
            role: 'system',
            content: `
STEP BUDGET

The run is entering its final execution window.

Do not stop immediately.

Prioritize completion over additional breadth.

Now:
- inspect the task list
- finish high-value active tasks
- complete tasks whose objective has been achieved
- stop low-value exploratory branches
- avoid duplicate searches
- avoid redundant delegation
- resolve important contradictions
- persist accepted results
- deduplicate structured results
- update working memory
- update continuation state
- prepare final synthesis

Do not restart completed research.

Use the remaining execution budget to finish the user's actual objective.
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
FINAL EXECUTION WINDOW

The run is close to the 180-step limit.

Do not call additional tools.

Finish using existing evidence and state.

Before answering:
- inspect task state
- inspect working memory
- use accepted persisted findings already available in context
- preserve unresolved contradictions
- preserve uncertainty
- do not claim unfinished work was completed
- report material blockers when relevant
- provide the strongest complete answer possible

Return the final synthesis now.
`,
        },
      ],
    };
  }
}

export const stepBudgetProcessor =
  new StepBudgetProcessor();