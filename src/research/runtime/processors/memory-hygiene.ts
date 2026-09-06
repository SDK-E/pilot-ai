import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from '@mastra/core/processors';

import { pilotConfig } from '../config';

export class MemoryHygieneProcessor
  implements Processor
{
  readonly id =
    'memory-hygiene';

  readonly name =
    'Memory Hygiene';

  async processInputStep({
    stepNumber,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const every =
      pilotConfig.research
        .memoryHygieneEvery;

    if (
      stepNumber < every ||
      stepNumber % every !== 0
    ) {
      return {};
    }

    return {
      systemMessages: [
        {
          role: 'system',

          content: `
MEMORY HYGIENE

Review the persistent working memory for the current thread.

Keep it useful for continuation, not as a raw execution log.

Compact it when necessary using updateWorkingMemory.

Preserve:
- the current user objective
- explicit user constraints
- requested output
- meaningful completed work
- current in-progress work
- important pending work
- blockers
- important verified findings
- important rejected findings that prevent repeated work
- useful source URLs
- confidence and verification status when relevant
- unresolved contradictions
- important decisions and assumptions
- continuation notes
- accepted collected results

Remove or merge:
- duplicate findings
- duplicate URLs
- duplicate entities
- completed tasks that are represented several times
- old pending entries that are now completed
- stale in-progress entries
- trivial query variants
- raw page contents
- raw tool outputs
- verbose reasoning
- obsolete intermediate notes
- low-value temporary details
- repeated instructions
- information that is already represented more clearly elsewhere

EXECUTION STATE

Ensure:

### Completed
contains only meaningful completed stages.

### In Progress
contains only work actually being performed now.

### Pending
contains only relevant remaining work.

### Blocked
contains only unresolved blockers.

Move entries between sections when their state changes.

RESEARCH PROGRESS

For Queries Tried:
- preserve useful query families
- remove trivial variants and duplicates

For Sources Visited:
- keep important canonical URLs
- remove duplicates

For Important Findings:
- merge findings about the same entity or claim
- preserve strongest evidence
- preserve useful confidence and verification status

For Rejected Findings:
- retain only rejections useful for preventing repeated work

For Remaining Research:
- remove completed directions
- preserve high-value unexplored directions

COLLECTED RESULTS

Resolve duplicate entities.

Prefer one compact canonical result containing:
- identity
- strongest evidence
- useful metadata
- verification status
- confidence
- unresolved contradictions

Do not keep multiple copies of the same real-world entity merely because it appeared through different sources.

CONTINUATION NOTES

Keep this section short and actionable.

It should tell a future execution:
- what has already been accomplished
- what remains
- what should happen next
- what must not be repeated

Do not erase useful state merely to make memory shorter.

Optimize for:
ACCURACY
→ CONTINUITY
→ NON-REPETITION
→ COMPACTNESS
`,
        },
      ],
    };
  }
}

export const memoryHygieneProcessor =
  new MemoryHygieneProcessor();