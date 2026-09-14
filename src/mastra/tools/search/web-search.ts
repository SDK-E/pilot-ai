import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { performUrlFetch } from "../web/url-fetch.js";

import {
  performLangSearch,
  searchResultSchema,
  type SearchResult,
} from "./langsearch.js";
import { performDorkSearch } from "./search-dorks.js";

const webSearchResultSchema = searchResultSchema.extend({
  markdown: z.string().optional(),
  fetchError: z.string().optional(),
});

const fallbackSchema = z.object({
  stage: z.enum(["primary", "simplified", "dork"]),
  query: z.string(),
  resultCount: z.number().int().min(0),
});

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function simplifyQuery(query: string): string {
  return query
    .replaceAll(/\b(?:site|intitle|inurl|filetype|after|before):[^\s)]+/gi, " ")
    .replaceAll(/[()"']/g, " ")
    .replaceAll(/\bOR\b/gi, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 12)
    .join(" ");
}

function dedupe(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function resilientSearch(
  query: string,
  maxResults: number,
  abortSignal?: AbortSignal,
): Promise<{
  results: SearchResult[];
  fallbackTrace: z.infer<typeof fallbackSchema>[];
}> {
  const fallbackTrace: z.infer<typeof fallbackSchema>[] = [];

  const primary = await performLangSearch(query, maxResults, abortSignal);
  fallbackTrace.push({ stage: "primary", query, resultCount: primary.length });
  if (primary.length > 0) {
    return { results: primary, fallbackTrace };
  }

  const simplified = simplifyQuery(query);
  if (simplified && simplified !== query) {
    const retry = await performLangSearch(simplified, maxResults, abortSignal);
    fallbackTrace.push({
      stage: "simplified",
      query: simplified,
      resultCount: retry.length,
    });

    if (retry.length > 0) {
      return { results: retry, fallbackTrace };
    }
  }

  const dorkSearches = await performDorkSearch(
    {
      rawQuery: query,
      maxQueries: 5,
      maxResultsPerQuery: maxResults,
    },
    abortSignal,
  );
  const dorkResults = dedupe(dorkSearches.flatMap((item) => item.results));
  fallbackTrace.push({
    stage: "dork",
    query,
    resultCount: dorkResults.length,
  });

  if (dorkResults.length > 0) {
    return {
      results: dorkResults.slice(0, maxResults),
      fallbackTrace,
    };
  }

  return { results: [], fallbackTrace };
}

type WebSearchResult = z.infer<typeof webSearchResultSchema>;

/**
 * Reads the first pages of a result list and attaches their Markdown; a
 * page that fails to load keeps its snippet and records the error.
 */
async function withPageContents(
  results: SearchResult[],
  limits: { maxPages: number; maxCharactersPerPage: number },
  abortSignal?: AbortSignal,
): Promise<WebSearchResult[]> {
  const pagesToRead = results.slice(0, limits.maxPages);
  const fetched = await Promise.allSettled(
    pagesToRead.map((result) =>
      performUrlFetch(result.url, limits.maxCharactersPerPage, abortSignal),
    ),
  );
  return results.map((result, index) => {
    const page = fetched.at(index);
    if (!page) return result;
    if (page.status === "fulfilled") {
      return {
        ...result,
        title: page.value.title ?? result.title,
        url: page.value.url,
        markdown: page.value.content,
        content: page.value.content,
      };
    }
    const reason: unknown = page.reason;
    return {
      ...result,
      fetchError: reason instanceof Error ? reason.message : String(reason),
    };
  });
}

function describeResult(result: WebSearchResult, index: number): string {
  return [
    `${index + 1}. ${result.title}`,
    result.url,
    result.publishedAt ? `Published: ${result.publishedAt}` : undefined,
    result.markdown ?? result.snippet ?? result.content,
    result.fetchError ? `Page read failed: ${result.fetchError}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function describeEmpty(trace: z.infer<typeof fallbackSchema>[]): string {
  const stages = trace.map((item) => `${item.stage}: ${item.resultCount}`);
  return `No web results were returned after fallback attempts.\n${stages.join(" | ")}`;
}

export const webSearch = createTool({
  id: "web-search",

  description:
    "Search the public web or read a public URL. Empty searches automatically retry with a simpler query, then dork-aware search before returning no results.",

  inputSchema: z.object({
    query: z.string().min(1),
    maxResults: z.number().int().min(1).max(10).default(5),
    readPages: z.boolean().default(true),
    maxPages: z.number().int().min(1).max(5).default(3),
    maxCharactersPerPage: z
      .number()
      .int()
      .min(1000)
      .max(50_000)
      .default(15_000),
  }),

  outputSchema: z.object({
    results: z.array(webSearchResultSchema),
    fallbackTrace: z.array(fallbackSchema).default([]),
  }),

  execute: async (
    { query, maxResults, readPages, maxPages, maxCharactersPerPage },
    { abortSignal },
  ) => {
    if (isHttpUrl(query)) {
      const page = await performUrlFetch(
        query,
        maxCharactersPerPage,
        abortSignal,
      );
      return {
        results: [
          {
            title: page.title ?? page.url,
            url: page.url,
            markdown: page.content,
            content: page.content,
          },
        ],
        fallbackTrace: [],
      };
    }

    const search = await resilientSearch(query, maxResults, abortSignal);
    const results =
      readPages && search.results.length > 0
        ? await withPageContents(
            search.results,
            { maxPages, maxCharactersPerPage },
            abortSignal,
          )
        : search.results;
    return { results, fallbackTrace: search.fallbackTrace };
  },

  toModelOutput: (output) => ({
    type: "text",
    value:
      output.results.length === 0
        ? describeEmpty(output.fallbackTrace)
        : output.results
            .map((result, index) => describeResult(result, index))
            .join("\n\n---\n\n"),
  }),
});
