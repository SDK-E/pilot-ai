import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const researchScratchpad = createTool({
  id: 'research-scratchpad',

  description: `
Manage durable research state for the current thread.

The actual state belongs in working memory.

Use this tool to explicitly request updates to:
- objective
- completed work
- in-progress work
- pending work
- blocked work
- queries tried
- visited sources
- findings
- rejected findings
- remaining research
- decisions
- continuation notes

Never create process-local or run-local state.
`,

  inputSchema: z.object({
    action: z.enum([
      'read',
      'set-objective',

      'complete',
      'start',
      'pending',
      'blocked',

      'add-query',
      'add-source',
      'add-finding',
      'reject-finding',
      'add-next-step',
      'add-decision',
      'set-continuation',
    ]),

    value: z.string().optional(),
  }),

  outputSchema: z.object({
    instruction: z.string(),
  }),

  execute: async ({
    action,
    value,
  }) => {
    const text = value?.trim() ?? '';

    switch (action) {
      case 'read':
        return {
          instruction: `
Read the existing Pilot Browser working memory before continuing.

Pay particular attention to:

## Current Objective

## Execution State
### Completed
### In Progress
### Pending
### Blocked

## Research Progress
### Queries Tried
### Sources Visited
### Important Findings
### Rejected Findings
### Remaining Research

## Decisions And Assumptions

## Continuation Notes

Continue from existing state instead of rebuilding completed research.
`,
        };

      case 'set-objective':
        return {
          instruction: `
Update working memory:

## Current Objective

${text}

Preserve unrelated state.
`,
        };

      case 'complete':
        return {
          instruction: `
Move or append this meaningful completed work under:

## Execution State
### Completed

${text}

Remove the same item from In Progress or Pending when present.
`,
        };

      case 'start':
        return {
          instruction: `
Set this meaningful stage under:

## Execution State
### In Progress

${text}

Do not duplicate work already marked Completed.
`,
        };

      case 'pending':
        return {
          instruction: `
Add this remaining work under:

## Execution State
### Pending

${text}
`,
        };

      case 'blocked':
        return {
          instruction: `
Add this blocked work under:

## Execution State
### Blocked

${text}

Include the reason when known.
`,
        };

      case 'add-query':
        return {
          instruction: `
Append this useful query or query family under:

## Research Progress
### Queries Tried

${text}

Avoid duplicate or trivial variants.
`,
        };

      case 'add-source':
        return {
          instruction: `
Append this important processed source under:

## Research Progress
### Sources Visited

${text}

Avoid duplicate canonical URLs.
`,
        };

      case 'add-finding':
        return {
          instruction: `
Append this durable finding under:

## Research Progress
### Important Findings

${text}

Preserve when useful:
- entity
- claim
- evidence URL
- source type
- date
- confidence
- verification status
- contradiction status
`,
        };

      case 'reject-finding':
        return {
          instruction: `
Append this rejected or invalidated finding under:

## Research Progress
### Rejected Findings

${text}

Store it only when remembering the rejection prevents repeated work.
`,
        };

      case 'add-next-step':
        return {
          instruction: `
Append this useful unexplored direction under:

## Research Progress
### Remaining Research

${text}
`,
        };

      case 'add-decision':
        return {
          instruction: `
Append this important execution decision or assumption under:

## Decisions And Assumptions

${text}
`,
        };

      case 'set-continuation':
        return {
          instruction: `
Update:

## Continuation Notes

${text}

Include enough context for a later execution to continue without restarting.
`,
        };
    }
  },
});