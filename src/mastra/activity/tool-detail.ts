const MAX_DETAIL_CHARS = 4000;
const TRUNCATION_MARKER = "\n\n…(truncated)";

function truncate(value: string, limit = MAX_DETAIL_CHARS): string {
  return value.length > limit
    ? value.slice(0, limit - TRUNCATION_MARKER.length) + TRUNCATION_MARKER
    : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface SandboxStep {
  cmd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

function isSandboxOutput(
  value: unknown,
): value is { steps: SandboxStep[]; didStopEarly: boolean } {
  return isRecord(value) && Array.isArray(value.steps);
}

function formatSandboxRun(output: unknown): string | undefined {
  if (!isSandboxOutput(output)) return undefined;
  // One fenced block per command: the prompt, then whatever it printed.
  // Nothing here labels stdout vs. stderr or reports an exit code — the
  // person reading this just needs the command and its result, not which
  // stream it came out on.
  const blocks = output.steps.map((step) => {
    const result = [step.stdout, step.stderr].filter(Boolean).join("\n").trim();
    return `\`\`\`bash\n$ ${step.cmd}\n${result || "(no output)"}\n\`\`\``;
  });
  if (output.didStopEarly) {
    blocks.push("*(stopped: a command failed or the time budget ran out)*");
  }
  return truncate(blocks.join("\n\n"));
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
  markdown?: string;
  fetchError?: string;
}

function isWebSearchOutput(
  value: unknown,
): value is { results: WebSearchResult[] } {
  return isRecord(value) && Array.isArray(value.results);
}

function formatWebSearch(input: unknown, output: unknown): string | undefined {
  if (!isWebSearchOutput(output)) return undefined;
  const query =
    isRecord(input) && typeof input.query === "string"
      ? input.query
      : undefined;
  const lines = output.results.map((result) => {
    const excerpt = result.markdown ?? result.snippet;
    return [
      `- [${result.title}](${result.url})`,
      excerpt ? `  ${excerpt.slice(0, 300).replaceAll("\n", " ")}` : undefined,
      result.fetchError
        ? `  *(page read failed: ${result.fetchError})*`
        : undefined,
    ]
      .filter(Boolean)
      .join("\n");
  });
  const header = query ? `**Query:** ${query}\n\n` : "";
  return truncate(
    header + (lines.length > 0 ? lines.join("\n") : "*No results.*"),
  );
}

function isUrlFetchOutput(
  value: unknown,
): value is { url: string; title?: string; content: string } {
  return (
    isRecord(value) &&
    typeof value.url === "string" &&
    typeof value.content === "string"
  );
}

function formatUrlFetch(output: unknown): string | undefined {
  if (!isUrlFetchOutput(output)) return undefined;
  const header = output.title
    ? `**${output.title}**\n${output.url}`
    : output.url;
  return truncate(`${header}\n\n${output.content.slice(0, 2000)}`);
}

interface FetchedPage {
  url: string;
  title?: string;
  content?: string;
  error?: string;
}

function isBulkUrlFetchOutput(
  value: unknown,
): value is { pages: FetchedPage[] } {
  return isRecord(value) && Array.isArray(value.pages);
}

function formatBulkUrlFetch(output: unknown): string | undefined {
  if (!isBulkUrlFetchOutput(output)) return undefined;
  const blocks = output.pages.map((page) => {
    if (page.error) return `${page.url}\n*(failed: ${page.error})*`;
    const header = page.title ? `**${page.title}**\n${page.url}` : page.url;
    return `${header}\n\n${(page.content ?? "").slice(0, 1000)}`;
  });
  return truncate(blocks.join("\n\n---\n\n"));
}

interface SitePage {
  url: string;
  source: "robots" | "sitemap" | "homepage";
}

function isSiteDiscoveryOutput(
  value: unknown,
): value is { origin: string; pages: SitePage[] } {
  return isRecord(value) && Array.isArray(value.pages);
}

function formatSiteDiscovery(output: unknown): string | undefined {
  if (!isSiteDiscoveryOutput(output)) return undefined;
  const lines = output.pages.map((page) => `- ${page.url} *(${page.source})*`);
  return truncate(
    `**${output.origin}**\n\n${lines.length > 0 ? lines.join("\n") : "*No pages found.*"}`,
  );
}

function isDomainIntelligenceOutput(value: unknown): value is {
  domain: string;
  ipv4: string[];
  ipv6: string[];
  mx: { exchange: string; priority: number }[];
  nameservers: string[];
  txt: string[][];
  canReceiveEmail: boolean;
} {
  return isRecord(value) && typeof value.domain === "string";
}

function formatDomainIntelligence(output: unknown): string | undefined {
  if (!isDomainIntelligenceOutput(output)) return undefined;
  const rows: [string, string][] = [
    ["Domain", output.domain],
    ["A", output.ipv4.join(", ") || "—"],
    ["AAAA", output.ipv6.join(", ") || "—"],
    [
      "MX",
      output.mx
        .map((entry) => `${entry.exchange} (${String(entry.priority)})`)
        .join(", ") || "—",
    ],
    ["NS", output.nameservers.join(", ") || "—"],
    ["TXT", output.txt.map((entry) => entry.join("")).join(" | ") || "—"],
    ["Can receive email", output.canReceiveEmail ? "yes" : "no"],
  ];
  return truncate(
    rows.map(([label, value]) => `- **${label}:** ${value}`).join("\n"),
  );
}

function formatGithubPublic(output: unknown): string | undefined {
  if (!isRecord(output) || !("data" in output)) return undefined;
  return truncate(
    `\`\`\`json\n${JSON.stringify(output.data, null, 2)}\n\`\`\``,
  );
}

const FORMATTERS = new Map<
  string,
  (input: unknown, output: unknown) => string | undefined
>([
  ["sandbox-run", (_input, output) => formatSandboxRun(output)],
  ["webSearch", (input, output) => formatWebSearch(input, output)],
  ["urlFetch", (_input, output) => formatUrlFetch(output)],
  ["bulkUrlFetch", (_input, output) => formatBulkUrlFetch(output)],
  ["siteDiscovery", (_input, output) => formatSiteDiscovery(output)],
  ["domainIntelligence", (_input, output) => formatDomainIntelligence(output)],
  ["githubPublic", (_input, output) => formatGithubPublic(output)],
]);

/**
 * Formats one tool call's real input/output into a single bounded Markdown
 * string for display in Pilot's activity trace — rendered later through the
 * same Streamdown component already used for reply text, so fenced code
 * blocks get syntax highlighting and a copy button for free. Returns
 * undefined for a failed call, an unrecognized tool, or a tool (ask_user,
 * scratchpad, plan) that already has its own dedicated, always-visible UI.
 */
export function buildToolDetail(
  toolName: string,
  input: unknown,
  output: unknown,
  error: unknown,
): string | undefined {
  if (error !== undefined) return undefined;
  const formatter = FORMATTERS.get(toolName);
  if (!formatter) return undefined;
  return formatter(input, output);
}
