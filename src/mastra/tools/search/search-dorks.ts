import { performLangSearch, type SearchResult } from "./langsearch.js";

export interface DorkQueryInput {
  rawQuery?: string;
  terms?: string[];
  exactPhrases?: string[];
  anyOf?: string[];
  exclude?: string[];
  sites?: string[];
  inTitle?: string[];
  inUrl?: string[];
  fileTypes?: string[];
  after?: string;
  before?: string;
}

function quote(value: string): string {
  const escaped = value.trim().replaceAll('"', String.raw`\"`);
  return `"${escaped}"`;
}

function normalize(values?: string[]): string[] {
  return [
    ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
}

function buildBaseQuery(input: DorkQueryInput): string {
  const anyOf = normalize(input.anyOf);
  const parts = [
    ...normalize(input.terms),
    ...normalize(input.exactPhrases).map((value) => quote(value)),
    ...(anyOf.length > 0
      ? [`(${anyOf.map((value) => quote(value)).join(" OR ")})`]
      : []),
    ...normalize(input.exclude).map((value) => `-${quote(value)}`),
    ...normalize(input.inTitle).map((value) => `intitle:${quote(value)}`),
    ...normalize(input.inUrl).map((value) => `inurl:${quote(value)}`),
    ...normalize(input.fileTypes).map(
      (value) => `filetype:${value.replace(/^\./, "")}`,
    ),
    ...(input.after ? [`after:${input.after}`] : []),
    ...(input.before ? [`before:${input.before}`] : []),
  ];
  return parts.join(" ").trim();
}

const SITE_OPERATOR = /(?:^|\s)site:([^\s)]+)/gi;

/**
 * Turns one search intent into search-engine queries. Several `site:`
 * operators become one query per site.
 */
export function buildDorkQueries(
  input: DorkQueryInput & { maxQueries: number },
): string[] {
  let base = input.rawQuery?.trim() ?? "";
  if (base === "") base = buildBaseQuery(input);
  if (!base) return [];

  const rawSites = Array.from(base.matchAll(SITE_OPERATOR), (match) =>
    match[1].trim(),
  ).filter(Boolean);
  if (rawSites.length > 1) {
    base = base.replaceAll(SITE_OPERATOR, " ").replaceAll(/\s+/g, " ").trim();
  }

  const sites = normalize([
    ...(rawSites.length > 1 ? rawSites : []),
    ...normalize(input.sites),
  ]);
  if (sites.length === 0) return [base];
  return sites
    .map((site) => `${base} site:${site}`.trim())
    .slice(0, input.maxQueries);
}

export async function performDorkSearch(
  input: DorkQueryInput & { maxQueries?: number; maxResultsPerQuery?: number },
  abortSignal?: AbortSignal,
): Promise<{ query: string; results: SearchResult[] }[]> {
  const queries = buildDorkQueries({
    ...input,
    maxQueries: input.maxQueries ?? 5,
  });

  const settled = await Promise.allSettled(
    queries.map(async (query) => ({
      query,
      results: await performLangSearch(
        query,
        input.maxResultsPerQuery ?? 5,
        abortSignal,
      ),
    })),
  );

  return settled.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : { query: queries[index], results: [] },
  );
}
