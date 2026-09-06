import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  getCachedValue,
  makeCacheKey,
  setCachedValue,
} from '../cache';

import { pilotConfig } from '../config';

export const searchResultSchema =
  z.object({
    title: z.string(),
    url: z.string(),

    snippet:
      z.string().optional(),

    content:
      z.string().optional(),

    publishedAt:
      z.string().optional(),
  });

export type SearchResult =
  z.infer<
    typeof searchResultSchema
  >;

type LangSearchWebPage = {
  name?: unknown;
  url?: unknown;
  snippet?: unknown;
  summary?: unknown;
  datePublished?: unknown;
};

type LangSearchResponse = {
  webPages?: {
    value?:
      LangSearchWebPage[];
  };
};

function asString(
  value: unknown,
): string | undefined {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  )
    ? value.trim()
    : undefined;
}

export async function performLangSearch(
  query: string,
  maxResults = 5,
  abortSignal?: AbortSignal,
): Promise<SearchResult[]> {
  const apiKey =
    process.env
      .LANGSEARCH_API_KEY;

  if (!apiKey) {
    throw new Error(
      'LANGSEARCH_API_KEY is not configured',
    );
  }

  const normalizedQuery =
    query.trim();

  const count = Math.min(
    Math.max(
      maxResults,
      1,
    ),
    10,
  );

  const cacheKey =
    makeCacheKey(
      'lang-search',
      {
        query:
          normalizedQuery
            .toLowerCase(),

        count,
      },
    );

  const cached =
    await getCachedValue<
      SearchResult[]
    >(cacheKey);

  if (cached) {
    return cached;
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),

      pilotConfig.network
        .fetchTimeoutMs,
    );

  const onAbort = () =>
    controller.abort();

  abortSignal?.addEventListener(
    'abort',
    onAbort,
    {
      once: true,
    },
  );

  try {
    const response =
      await fetch(
        'https://api.langsearch.com/v1/web-search',
        {
          method: 'POST',

          signal:
            controller.signal,

          headers: {
            authorization:
              `Bearer ${apiKey}`,

            'content-type':
              'application/json',
          },

          body: JSON.stringify({
            query:
              normalizedQuery,

            freshness:
              'noLimit',

            summary: true,

            count,
          }),
        },
      );

    if (!response.ok) {
      throw new Error(
        `LangSearch ${response.status}: ${await response.text()}`,
      );
    }

    const data =
      (await response.json()) as LangSearchResponse;

    const pages =
      Array.isArray(
        data.webPages?.value,
      )
        ? data.webPages.value
        : [];

    const results =
      pages
        .map(
          (
            page,
          ): SearchResult | null => {
            const url =
              asString(
                page.url,
              );

            if (!url) {
              return null;
            }

            return {
              title:
                asString(
                  page.name,
                ) ?? url,

              url,

              snippet:
                asString(
                  page.snippet,
                ),

              content:
                asString(
                  page.summary,
                ) ??
                asString(
                  page.snippet,
                ),

              publishedAt:
                asString(
                  page.datePublished,
                ),
            };
          },
        )
        .filter(
          (
            result,
          ): result is SearchResult =>
            result !== null,
        )
        .slice(
          0,
          count,
        );

    await setCachedValue(
      cacheKey,
      'lang-search',
      results,

      pilotConfig.cache
        .searchTtlMs,
    );

    return results;
  } finally {
    clearTimeout(timeout);

    abortSignal
      ?.removeEventListener(
        'abort',
        onAbort,
      );
  }
}

export const langSearch =
  createTool({
    id: 'lang-search',

    description:
      'Search the public web using LangSearch.',

    inputSchema: z.object({
      query:
        z.string().min(1),

      maxResults:
        z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(5),
    }),

    outputSchema: z.object({
      results: z.array(
        searchResultSchema,
      ),
    }),

    execute: async (
      {
        query,
        maxResults,
      },
      {
        abortSignal,
      },
    ) => ({
      results:
        await performLangSearch(
          query,
          maxResults,
          abortSignal,
        ),
    }),

    toModelOutput: (
      output,
    ) => ({
      type: 'text',

      value:
        output.results.length ===
        0
          ? 'No web search results were returned.'
          : output.results
              .map(
                (
                  result,
                  index,
                ) =>
                  [
                    `${index + 1}. ${result.title}`,
                    result.url,
                    result.snippet,

                    result.publishedAt
                      ? `Published: ${result.publishedAt}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join('\n'),
              )
              .join(
                '\n\n',
              ),
    }),
  });