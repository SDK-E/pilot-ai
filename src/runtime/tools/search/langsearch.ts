import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  getCachedValue,
  makeCacheKey,
  setCachedValue,
} from '../../cache/index.js';

import { pilotConfig } from '../../research/config/index.js';

export type LangSearchConfig = {
  apiKey?: string;
  fetchTimeoutMs?: number;
  searchTtlMs?: number;
};

let langSearchConfig: LangSearchConfig = {};

export function setLangSearchConfig(config: LangSearchConfig): void {
  langSearchConfig = { ...langSearchConfig, ...config };
}

export function getLangSearchConfig(): LangSearchConfig {
  return { ...langSearchConfig };
}

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

type LangSearchSearchData = {
  webPages?: {
    value?: LangSearchWebPage[];
  };
};

type LangSearchResponse = {
  code?: unknown;
  msg?: unknown;
  data?: LangSearchSearchData;
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

function asNumber(
  value: unknown,
): number | undefined {
  return typeof value === 'number'
    ? value
    : undefined;
}

export async function performLangSearch(
  query: string,
  maxResults = 5,
  abortSignal?: AbortSignal,
): Promise<SearchResult[]> {
  const config = getLangSearchConfig();
  const apiKey =
    config.apiKey ??
    process.env.LANGSEARCH_API_KEY;

  if (!apiKey) {
    throw new Error(
      'LANGSEARCH_API_KEY is not configured',
    );
  }

  const normalizedQuery =
    query.trim();

  if (!normalizedQuery) {
    throw new Error(
      'Web search query cannot be empty',
    );
  }

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

      config.fetchTimeoutMs ??
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

            'user-agent':
              'SDK-Pilot-Agent/1.0 (+https://sdk.enterprises; autonomous research agent)',
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

    const rawText =
      await response.text();

    if (!response.ok) {
      throw new Error(
        `LangSearch HTTP ${response.status}: ${rawText || response.statusText}`,
      );
    }

    let data: LangSearchResponse;

    try {
      data = JSON.parse(
        rawText,
      ) as LangSearchResponse;
    } catch {
      throw new Error(
        'LangSearch returned invalid JSON',
      );
    }

    const code =
      asNumber(data.code);

    if (
      code !== undefined &&
      code !== 200
    ) {
      throw new Error(
        `LangSearch API ${code}: ${asString(data.msg) ?? 'Unknown error'}`,
      );
    }

    const pages =
      Array.isArray(
        data.data?.webPages?.value,
      )
        ? data.data.webPages.value
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

    if (
      pages.length > 0 &&
      results.length === 0
    ) {
      throw new Error(
        'LangSearch returned pages but Pilot could not parse any valid URLs',
      );
    }

    await setCachedValue(
      cacheKey,
      'lang-search',
      results,

      config.searchTtlMs ??
        pilotConfig.cache
          .searchTtlMs,
    );

    return results;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'AbortError'
    ) {
      throw new Error(
        `LangSearch timed out after ${config.fetchTimeoutMs ?? pilotConfig.network.fetchTimeoutMs}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);

    abortSignal
      ?.removeEventListener(
        'abort',
        onAbort,
      );
  }
}

const langSearch =
  createTool({
    id: 'lang-search',

    description:
      'Search the public web using LangSearch. Throws explicit API/configuration errors instead of silently returning empty results when the upstream response is invalid.',

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
          ? 'No relevant web search results were returned for this query.'
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
