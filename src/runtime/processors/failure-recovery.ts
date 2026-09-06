import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

export class FailureRecoveryProcessor implements Processor {
  readonly id = 'failure-recovery';
  readonly name = 'Failure Recovery';

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    if (stepNumber < 1) {
      return {};
    }

    return {
      systemMessages: [
        {
          role: 'system',
          content: `
FAILURE RECOVERY

Tool or execution failures are recoverable unless evidence shows otherwise.

When a failure occurs:

1. identify what actually failed
2. determine whether the failure is:
   - temporary
   - rate limited
   - malformed input
   - unsupported input
   - inaccessible source
   - authentication related
   - missing data
   - tool-specific
3. do not abandon the user's objective merely because one call failed
4. choose the cheapest useful recovery

RECOVERY OPTIONS

When appropriate:
- correct malformed arguments
- retry a transient failure
- try another approach
- use another source
- continue with partial evidence when the missing data is non-essential

RATE LIMITS

For temporary rate limits:
- avoid immediately repeating identical calls
- continue another useful branch when possible
- retry later if still needed

SOURCE FAILURE

If one source is inaccessible:
- look for the canonical source
- search for another primary source
- use another independent source

TOOL FAILURE

Do not repeatedly call a failing tool with identical input.

After repeated equivalent failures:
- mark the path blocked
- preserve the blocker in state
- continue other useful work

PARTIAL SUCCESS

A failed enrichment field should not invalidate an otherwise useful result.

Preserve verified information and clearly represent missing fields.

STATE

When a meaningful path becomes blocked:
- update execution state
- record the blocker
- keep the task pending or blocked appropriately

When recovery succeeds:
- clear obsolete blocker state
- continue normally

Do not expose internal error noise in the final answer unless the failure materially affected what could be delivered.
`,
        },
      ],
    };
  }
}

export const failureRecoveryProcessor =
  new FailureRecoveryProcessor();
