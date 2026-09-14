import type {
  Processor,
  ProcessInputArgs,
  ProcessInputResult,
} from "@mastra/core/processors";

export class CurrentContextProcessor implements Processor {
  readonly id = "current-context";
  readonly name = "Current Context";

  processInput({ messageList }: ProcessInputArgs): ProcessInputResult {
    const now = new Date();
    const year = now.getUTCFullYear();
    const utcDate = now.toISOString().slice(0, 10);

    messageList.addSystem(
      `
<CURRENT_CONTEXT>
Current date and time: ${now.toISOString()}
Current UTC date: ${utcDate}
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
      "current-context",
    );

    return messageList;
  }
}

export const currentContextProcessor = new CurrentContextProcessor();
