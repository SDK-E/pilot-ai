import { isRecord, num, str, truncate } from "./format-helpers.js";

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

function formatGithub(output: unknown): string | undefined {
  return formatList(
    output,
    "items",
    (item) =>
      `- [#${String(num(item.number))} ${str(item.title)}](${str(item.url)}) (${str(item.state)})`,
    "*No issues found.*",
  );
}

function formatGoogleDrive(output: unknown): string | undefined {
  if (isRecord(output) && isRecord(output.file)) {
    const file = output.file;
    return truncate(
      `**${str(file.name)}** (${str(file.mimeType)})\n\n${str(file.content)}`,
    );
  }
  return formatList(
    output,
    "items",
    (item) => `- ${str(item.name)} (${str(item.mimeType)})`,
    "*No files found.*",
  );
}

function formatGmail(output: unknown): string | undefined {
  if (isRecord(output) && isRecord(output.message)) {
    const message = output.message;
    return truncate(
      `**${str(message.subject)}**\nFrom: ${str(message.from)}\n\n${str(message.body)}`,
    );
  }
  return formatList(
    output,
    "items",
    (item) => `- ${str(item.subject)} — ${str(item.from)}`,
    "*No messages found.*",
  );
}

function formatSlack(output: unknown): string | undefined {
  if (isRecord(output) && Array.isArray(output.channels)) {
    return formatList(
      output,
      "channels",
      (item) => `- #${str(item.name)}`,
      "*No channels found.*",
    );
  }
  return formatList(
    output,
    "messages",
    (item) => `- ${str(item.user)}: ${str(item.text)}`,
    "*No messages found.*",
  );
}

function formatNotion(output: unknown): string | undefined {
  if (isRecord(output) && isRecord(output.page)) {
    const page = output.page;
    return truncate(
      `**${str(page.title)}**\n${str(page.url)}\n\n${str(page.content)}`,
    );
  }
  return formatList(
    output,
    "items",
    (item) => `- [${str(item.title)}](${str(item.url)})`,
    "*No pages found.*",
  );
}

function formatLinear(output: unknown): string | undefined {
  return formatList(
    output,
    "items",
    (item) =>
      `- [${str(item.identifier)} ${str(item.title)}](${str(item.url)}) (${str(item.state)})`,
    "*No issues found.*",
  );
}

function formatVercel(output: unknown): string | undefined {
  if (isRecord(output) && isRecord(output.project)) {
    const project = output.project;
    return truncate(
      `**${str(project.name)}**\nLatest: ${str(project.latestDeploymentState, "unknown")} — ${str(project.latestDeploymentUrl, "n/a")}`,
    );
  }
  return formatList(
    output,
    "deployments",
    (item) => `- ${str(item.state)} — ${str(item.url)}`,
    "*No deployments found.*",
  );
}

function formatMonday(output: unknown): string | undefined {
  if (isRecord(output) && Array.isArray(output.boards)) {
    return formatList(
      output,
      "boards",
      (item) => `- ${str(item.name)}`,
      "*No boards found.*",
    );
  }
  return formatList(
    output,
    "items",
    (item) => `- ${str(item.name)} (${str(item.state, "unknown")})`,
    "*No items found.*",
  );
}

/**
 * Activity formatters for the 8 connector tools, keyed by the Mastra tool id
 * each is registered under. Built only from the typed output fields the
 * output schema already carries (non-secret provider content), never from
 * account identifiers or token-like values.
 */
export const CONNECTOR_FORMATTERS: [
  string,
  (input: unknown, output: unknown) => string | undefined,
][] = [
  ["connector-github", (_input, output) => formatGithub(output)],
  ["connector-google-drive", (_input, output) => formatGoogleDrive(output)],
  ["connector-gmail", (_input, output) => formatGmail(output)],
  ["connector-slack", (_input, output) => formatSlack(output)],
  ["connector-notion", (_input, output) => formatNotion(output)],
  ["connector-linear", (_input, output) => formatLinear(output)],
  ["connector-vercel", (_input, output) => formatVercel(output)],
  ["connector-monday", (_input, output) => formatMonday(output)],
];
