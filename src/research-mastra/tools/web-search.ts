import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  performLangSearch,
  searchResultSchema,
  type SearchResult,
} from './langsearch';
import { performDorkSearch } from './search-dorks';
import { performStagehandSearch } from './stagehand-browser';
import { performUrlFetch } from './url-fetch';

const webSearchResultSchema = searchResultSchema.extend({
  markdown: z.string().optional(),
  fetchError: z.string().optional(),
});

const fallbackSchema = z.object({
  stage: z.enum(['primary', 'simplified', 'dork', 'stagehand']),
  query: z.string(),
  resultCount: z.number().int().min(0),
});

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function simplifyQuery(query: string): string {
  return query
    .replace(/\b(?:site|intitle|inurl|filetype|after|before):[^\s)]+/gi, ' ')
    .replace(/[()"']/g, ' ')
    .replace(/\bOR\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 12)
    .join(' ');
}

function dedupe(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.url.replace(/\/$/, '').toLowerCase();
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
  fallbackTrace: Array<z.infer<typeof fallbackSchema>>;
}> {
  const fallbackTrace: Array<z.infer<typeof fallbackSchema>> = [];

  const primary = await performLangSearch(query, maxResults, abortSignal);
  fallbackTrace.push({ stage: 'primary', query, resultCount: primary.length });
  if (primary.length > 0) {
    return { results: primary, fallbackTrace };
  }

  const simplified = simplifyQuery(query);
  if (simplified && simplified !== query) {
    const retry = await performLangSearch(simplified, maxResults, abortSignal);
    fallbackTrace.push({
      stage: 'simplified',
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
    stage: 'dork',
    query,
    resultCount: dorkResults.length,
  });

  if (dorkResults.length > 0) {
    return {
      results: dorkResults.slice(0, maxResults),
      fallbackTrace,
    };
  }

  try {
    const stagehandQuery = simplified || query;
    const browserResults = await performStagehandSearch(stagehandQuery);
    fallbackTrace.push({
      stage: 'stagehand',
      query: stagehandQuery,
      resultCount: browserResults.length,
    });

    return {
      results: browserResults.slice(0, maxResults),
      fallbackTrace,
    };
  } catch {
    fallbackTrace.push({
      stage: 'stagehand',
      query: simplified || query,
      resultCount: 0,
    });

    return { results: [], fallbackTrace };
  }
}

export const webSearch = createTool({
  id: 'web-search',

  description:
    'Search the public web or read a public URL. Empty searches automatically retry with a simpler query, then dork-aware search, then Stagehand browser search before returning no results.',

  inputSchema: z.object({
    query: z.string().min(1),
    maxResults: z.number().int().min(1).max(10).default(5),
    readPages: z.boolean().default(true),
    maxPages: z.number().int().min(1).max(5).default(3),
    maxCharactersPerPage: z.number().int().min(1_000).max(50_000).default(15_000),
  }),

  outputSchema: z.object({
    results: z.array(webSearchResultSchema),
    fallbackTrace: z.array(fallbackSchema).default([]),
  }),

  execute: async (
    {
      query,
      maxResults,
      readPages,
      maxPages,
      maxCharactersPerPage,
    },
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
    const searchResults = search.results;

    if (!readPages || searchResults.length === 0) {
      return {
        results: searchResults,
        fallbackTrace: search.fallbackTrace,
      };
    }

    const pagesToRead = searchResults.slice(
      0,
      Math.min(maxPages, searchResults.length),
    );

    const fetched = await Promise.allSettled(
      pagesToRead.map((result) =>
        performUrlFetch(
          result.url,
          maxCharactersPerPage,
          abortSignal,
        ),
      ),
    );

    const results = searchResults.map((result, index) => {
      if (index >= pagesToRead.length) return result;

      const fetchedResult = fetched[index];
      if (fetchedResult.status === 'fulfilled') {
        return {
          ...result,
          title: fetchedResult.value.title ?? result.title,
          url: fetchedResult.value.url,
          markdown: fetchedResult.value.content,
          content: fetchedResult.value.content,
        };
      }

      return {
        ...result,
        fetchError:
          fetchedResult.reason instanceof Error
            ? fetchedResult.reason.message
            : String(fetchedResult.reason),
      };
    });

    return {
      results,
      fallbackTrace: search.fallbackTrace,
    };
  },

  toModelOutput: (output) => ({
    type: 'text',
    value:
      output.results.length === 0
        ? `No web results were returned after fallback attempts.\n${output.fallbackTrace.map((item) => `${item.stage}: ${item.resultCount}`).join(' | ')}`
        : output.results
            .map((result, index) =>
              [
                `${index + 1}. ${result.title}`,
                result.url,
                result.publishedAt ? `Published: ${result.publishedAt}` : undefined,
                result.markdown ?? result.snippet ?? result.content,
                result.fetchError ? `Page read failed: ${result.fetchError}` : undefined,
              ]
                .filter(Boolean)
                .join('\n\n'),
            )
            .join('\n\n---\n\n'),
  }),
});
