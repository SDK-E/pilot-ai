import { isRecord, str, truncate } from "./format-helpers.js";

function formatList(
  output: unknown,
  key: string,
  line: (item: Record<string, unknown>) => string,
  emptyLabel: string,
): string | undefined {
  if (!isRecord(output) || !Array.isArray(output[key])) return undefined;
  const items = output[key] as unknown[];
  return truncate(
    items.length === 0
      ? emptyLabel
      : items
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => line(item))
          .join("\n"),
  );
}

function formatConnector(output: unknown): string | undefined {
  if (
    isRecord(output) &&
    output.confirmationRequired &&
    isRecord(output.action)
  ) {
    return truncate(`*Awaiting confirmation:* ${str(output.action.label)}`);
  }
  if (isRecord(output) && Array.isArray(output.connectors)) {
    return formatList(
      output,
      "connectors",
      (item) => `- ${str(item.displayName)} (${str(item.slug)})`,
      "*No connectors connected.*",
    );
  }
  if (isRecord(output) && isRecord(output.item)) {
    return truncate(str(output.item.title, str(output.item.id, "OK")));
  }
  return formatList(
    output,
    "items",
    (item) => `- ${str(item.title, str(item.id, "item"))}`,
    "*No results.*",
  );
}

/**
 * Activity formatter for the connector tool, keyed by its Mastra tool id.
 * Built only from the typed output fields the output schema already carries
 * (non-secret provider content), never from account identifiers or
 * token-like values.
 */
export const CONNECTOR_FORMATTERS: [
  string,
  (input: unknown, output: unknown) => string | undefined,
][] = [["connector", (_input, output) => formatConnector(output)]];
