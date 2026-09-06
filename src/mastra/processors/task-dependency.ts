import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

export class TaskDependencyProcessor
  implements Processor
{
  readonly id =
    'task-dependency';

  readonly name =
    'Task Dependency';

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    if (
      stepNumber < 2 ||
      stepNumber % 4 !== 0
    ) {
      return {};
    }

    return {
      systemMessages: [
        {
          role: 'system',

          content: `
TASK DEPENDENCIES

Review the current task list before selecting the next meaningful task.

Some tasks depend on others.

Examples:

VERIFY COMPANY
→ FIND DECISION MAKER
→ VERIFY DECISION MAKER
→ FIND PUBLIC CONTACT

DISCOVER CANDIDATES
→ QUALIFY CANDIDATES
→ VERIFY HIGH-VALUE CANDIDATES
→ EXPORT

IDENTIFY REPOSITORY
→ CHECK CURRENT VERSION
→ INSPECT IMPLEMENTATION
→ COMPARE BEHAVIOR

Do not start a dependent task when its prerequisite is unresolved unless parallel execution is genuinely useful.

When a prerequisite fails:
- block dependent tasks when appropriate
- preserve why they are blocked
- seek another path if available

When a prerequisite completes:
- unblock relevant dependent tasks
- continue with highest-value available work

Prioritize:
1. high-value unblocked tasks
2. tasks that unlock several dependents
3. verification needed for final output
4. low-value independent tasks last

Do not create unnecessary dependency chains for simple requests.

Keep task state accurate.
`,
        },
      ],
    };
  }
}

export const taskDependencyProcessor =
  new TaskDependencyProcessor();