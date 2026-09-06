import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

export type StepBudgetConfig = {
  maxSteps: number;
  warningAt: number;
  finalAt: number;
};

export class StepBudgetProcessor
  implements Processor
{
  readonly id = 'step-budget';

  readonly name = 'Step Budget';

  constructor(
    private readonly config: StepBudgetConfig,
  ) {}

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const {
      maxSteps,
      warningAt,
      finalAt,
    } = this.config;

    if (stepNumber < warningAt) {
      return {};
    }

    if (stepNumber < finalAt) {
      return {
        systemMessages: [
          {
            role: 'system',
            content: `
STEP BUDGET

The run is entering its final execution window.

Configured maximum: ${maxSteps} steps.

Do not stop immediately.

Prioritize completion over additional breadth.

Now:
- inspect the current task or conversation state
- finish high-value active work
- complete tasks whose objective has been achieved
- stop low-value exploratory branches
- avoid duplicate work
- resolve important contradictions
- prepare final synthesis

Do not restart completed work.

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

The run is close to the configured ${maxSteps}-step limit.

Do not call additional tools.

Finish using existing evidence and state.

Before answering:
- inspect task or conversation state
- use accepted findings already available in context
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

export function createStepBudgetProcessor(
  config: StepBudgetConfig,
) {
  return new StepBudgetProcessor(config);
}
