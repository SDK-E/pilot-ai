import { z } from "zod";

import { pilotConfig } from "../../agents/base/profiles/index.js";
import {
  getCachedValue,
  makeCacheKey,
  setCachedValue,
} from "../../cache/index.js";
import { AGENT_USER_AGENT } from "../web/url-fetch.js";

export const searchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string().optional(),
  content: z.string().optional(),
  publishedAt: z.string().optional(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

const langSearchResponseSchema = z.object({
  code: z.number().optional(),
  // The real API sends `"msg": null` on a successful response, not a missing
  // field — `.optional()` alone rejects `null` and fails every response.
  msg: z.string().nullable().optional(),
  data: z
    .object({
      webPages: z
        .object({
          value: z.array(z.record(z.string(), z.unknown())).optional(),
        })
        .optional(),
    })
    .optional(),
});

const MAX_RESULTS = 10;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function toSearchResult(page: Record<string, unknown>): SearchResult | null {
  const url = asString(page.url);
  if (!url) return null;
  return {
    title: asString(page.name) ?? url,
    url,
    snippet: asString(page.snippet),
    content: asString(page.summary) ?? asString(page.snippet),
    publishedAt: asString(page.datePublished),
  };
}

function apiKey(): string {
  const key = process.env.LANGSEARCH_API_KEY;
  if (!key) throw new Error("LANGSEARCH_API_KEY is not configured");
  return key;
}

function parseSearchResponse(rawText: string, count: number): SearchResult[] {
  const parsed = langSearchResponseSchema.safeParse(JSON.parse(rawText));
  if (!parsed.success) throw new Error("LangSearch returned invalid JSON");
  const { code, msg, data } = parsed.data;
  if (code !== undefined && code !== 200) {
    throw new Error(`LangSearch API ${code}: ${msg ?? "Unknown error"}`);
  }
  const pages = data?.webPages?.value ?? [];
  const results = pages
    .map((page) => toSearchResult(page))
    .filter((result): result is SearchResult => result !== null)
    .slice(0, count);
  if (pages.length > 0 && results.length === 0) {
    throw new Error(
      "LangSearch returned pages but Pilot could not parse any valid URLs",
    );
  }
  return results;
}

async function requestSearch(
  query: string,
  count: number,
  signal: AbortSignal,
): Promise<SearchResult[]> {
  const response = await fetch("https://api.langsearch.com/v1/web-search", {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
      "user-agent": AGENT_USER_AGENT,
    },
    body: JSON.stringify({ query, freshness: "noLimit", summary: true, count }),
  });
  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `LangSearch HTTP ${response.status}: ${rawText || response.statusText}`,
    );
  }

  return parseSearchResponse(rawText, count);
}

/**
 * Searches the public web through LangSearch, with a cached result per
 * query and a hard timeout from the active profile.
 */
export async function performLangSearch(
  query: string,
  maxResults = 5,
  abortSignal?: AbortSignal,
): Promise<SearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new Error("Web search query cannot be empty");
  const count = Math.min(Math.max(maxResults, 1), MAX_RESULTS);

  const cacheKey = makeCacheKey("lang-search", {
    query: normalizedQuery.toLowerCase(),
    count,
  });
  const cached = await getCachedValue<SearchResult[]>(cacheKey);
  if (cached) return cached;

  const { fetchTimeoutMs } = pilotConfig.network;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, fetchTimeoutMs);
  const onAbort = () => {
    controller.abort();
  };
  abortSignal?.addEventListener("abort", onAbort, { once: true });

  try {
    const results = await requestSearch(
      normalizedQuery,
      count,
      controller.signal,
    );
    await setCachedValue(
      cacheKey,
      "lang-search",
      results,
      pilotConfig.cache.searchTtlMs,
    );
    return results;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`LangSearch timed out after ${fetchTimeoutMs}ms`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    abortSignal?.removeEventListener("abort", onAbort);
  }
}
