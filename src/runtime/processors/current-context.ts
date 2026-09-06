import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from '@mastra/core/processors';

export class CurrentContextProcessor implements Processor {
  readonly id = 'current-context';
  readonly name = 'Current Context';

  async processInput({
    messageList,
  }: ProcessInputArgs): Promise<ProcessInputResult> {
    const now = new Date();
    const iso = now.toISOString();
    const year = now.getUTCFullYear();
    const month = String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0');
    const day = String(
      now.getUTCDate(),
    ).padStart(2, '0');

    messageList.addSystem(
      `
<CURRENT_CONTEXT>
Current date and time: ${iso}
Current UTC date: ${year}-${month}-${day}
Current calendar year: ${year}
Unix timestamp: ${now.getTime()}

Treat this as authoritative runtime context.

For current or recent work:
- anchor freshness to the current date above
- do not default to last year or broad year ranges from memory
- do not add stale years such as ${year - 1} unless they are intentionally useful for historical context, comparison, or a source known to span that period
- prefer precise recency terms, date bounds, current titles, active status, and fresh evidence over spraying multiple years into queries
- when the user says today, current, latest, recent, now, active, or similar, interpret those relative to this runtime date
</CURRENT_CONTEXT>
`,
      'current-context',
    );

    return messageList;
  }
}

export const currentContextProcessor =
  new CurrentContextProcessor();
