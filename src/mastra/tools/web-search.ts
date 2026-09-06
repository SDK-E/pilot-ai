import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  performLangSearch,
  searchResultSchema,
} from './langsearch';
import { performUrlFetch } from './url-fetch';

const webSearchResultSchema =
  searchResultSchema.extend({
    markdown: z.string().optional(),
    fetchError: z.string().optional(),
  });

function isHttpUrl(
  value: string,
): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    );
  } catch {
    return false;
  }
}

export const webSearch =
  createTool({
    id: 'web-search',

    description:
      'Search the public web or read a public URL. Search results can be fetched and converted to Markdown so pages are read as structured content instead of raw HTML or flattened text.',

    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe(
          'A web search query or a complete HTTP(S) URL to read directly.',
        ),

      maxResults: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(5),

      readPages: z
        .boolean()
        .default(true),

      maxPages: z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(3),

      maxCharactersPerPage: z
        .number()
        .int()
        .min(1_000)
        .max(50_000)
        .default(15_000),
    }),

    outputSchema: z.object({
      results: z.array(
        webSearchResultSchema,
      ),
    }),

    execute: async (
      {
        query,
        maxResults,
        readPages,
        maxPages,
        maxCharactersPerPage,
      },
      {
        abortSignal,
      },
    ) => {
      if (isHttpUrl(query)) {
        const page =
          await performUrlFetch(
            query,
            maxCharactersPerPage,
            abortSignal,
          );

        return {
          results: [
            {
              title:
                page.title ??
                page.url,
              url: page.url,
              markdown:
                page.content,
              content:
                page.content,
            },
          ],
        };
      }

      const searchResults =
        await performLangSearch(
          query,
          maxResults,
          abortSignal,
        );

      if (
        !readPages ||
        searchResults.length === 0
      ) {
        return {
          results:
            searchResults,
        };
      }

      const pagesToRead =
        searchResults.slice(
          0,
          Math.min(
            maxPages,
            searchResults.length,
          ),
        );

      const fetched =
        await Promise.allSettled(
          pagesToRead.map(
            (result) =>
              performUrlFetch(
                result.url,
                maxCharactersPerPage,
                abortSignal,
              ),
          ),
        );

      const results =
        searchResults.map(
          (result, index) => {
            if (
              index >=
              pagesToRead.length
            ) {
              return result;
            }

            const fetchedResult =
              fetched[index];

            if (
              fetchedResult.status ===
              'fulfilled'
            ) {
              return {
                ...result,
                title:
                  fetchedResult.value
                    .title ??
                  result.title,
                url:
                  fetchedResult.value.url,
                markdown:
                  fetchedResult.value
                    .content,
                content:
                  fetchedResult.value
                    .content,
              };
            }

            return {
              ...result,
              fetchError:
                fetchedResult.reason instanceof
                Error
                  ? fetchedResult.reason
                      .message
                  : String(
                      fetchedResult.reason,
                    ),
            };
          },
        );

      return {
        results,
      };
    },

    toModelOutput: (
      output,
    ) => ({
      type: 'text',
      value:
        output.results.length === 0
          ? 'No web results were returned.'
          : output.results
              .map(
                (
                  result,
                  index,
                ) =>
                  [
                    `${index + 1}. ${result.title}`,
                    result.url,
                    result.publishedAt
                      ? `Published: ${result.publishedAt}`
                      : undefined,
                    result.markdown ??
                      result.snippet ??
                      result.content,
                    result.fetchError
                      ? `Page read failed: ${result.fetchError}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join('\n\n'),
              )
              .join(
                '\n\n---\n\n',
              ),
    }),
  });