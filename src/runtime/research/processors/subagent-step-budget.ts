import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

import { pilotConfig } from '../config';

function resolveBudget() {
  const {
    maxSteps,
    stepBudget,
  } = pilotConfig.agent.subagent;

  const finalAt = Math.min(
    stepBudget.finalAt,
    Math.max(
      1,
      maxSteps - 2,
    ),
  );

  const warningAt = Math.min(
    stepBudget.warningAt,
    Math.max(
      1,
      finalAt - 4,
    ),
  );

  return {
    maxSteps,
    warningAt,
    finalAt,
  };
}

export class SubagentStepBudgetProcessor
  implements Processor
{
  readonly id =
    'subagent-step-budget';

  readonly name =
    'Subagent Step Budget';

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const {
      maxSteps,
      warningAt,
      finalAt,
    } = resolveBudget();

    if (
      stepNumber < warningAt
    ) {
      return {};
    }

    if (
      stepNumber < finalAt
    ) {
      return {
        systemMessages: [
          {
            role: 'system',

            content: `
SUBAGENT STEP BUDGET

This delegated run is approaching its configured ${maxSteps}-step limit.

Prioritize completion.

Now:
- finish the delegated objective
- stop low-value exploration
- avoid duplicate searches
- resolve the highest-value remaining uncertainty
- preserve useful evidence URLs
- prepare a concise report for the supervisor

Stay strictly inside the delegated objective.
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
SUBAGENT FINAL WINDOW

The delegated run is close to its configured ${maxSteps}-step limit.

Do not call more tools.

Return the strongest concise evidence-backed result available now.

Preserve:
- direct findings
- evidence URLs
- contradictions
- uncertainty
- confidence when relevant

Do not pretend unfinished investigation was completed.
`,
        },
      ],
    };
  }
}

export const subagentStepBudgetProcessor =
  new SubagentStepBudgetProcessor();