import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { performUrlFetch } from '#runtime/tools/url-fetch';

const fetchedPageSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  error: z.string().optional(),
});

type FetchedPage = z.infer<typeof fetchedPageSchema>;

export const bulkUrlFetch = createTool({
  id: 'bulk-url-fetch',

  description:
    'Fetch several known public URLs concurrently. Prefer this over repeated single-page fetches when multiple pages need reading.',

  inputSchema: z.object({
    urls: z.array(z.string().url()).min(1).max(20),
    concurrency: z.number().int().min(1).max(10).default(5),
  }),

  outputSchema: z.object({
    pages: z.array(fetchedPageSchema),
  }),

  execute: async ({ urls, concurrency }) => {
    const uniqueUrls = [...new Set(urls)];

    const pages: FetchedPage[] = [];

    for (
      let index = 0;
      index < uniqueUrls.length;
      index += concurrency
    ) {
      const batch = uniqueUrls.slice(
        index,
        index + concurrency,
      );

      const results: FetchedPage[] =
        await Promise.all(
          batch.map(async (url): Promise<FetchedPage> => {
            try {
              const page =
                await performUrlFetch(url);

              return {
                url,
                title: page.title,
                content: page.content,
              };
            } catch (error) {
              return {
                url,
                error:
                  error instanceof Error
                    ? error.message
                    : String(error),
              };
            }
          }),
        );

      pages.push(...results);
    }

    return { pages };
  },

  toModelOutput: (output) => ({
    type: 'text',
    value: output.pages
      .map((page) => {
        if (page.error) {
          return `${page.url}\nERROR: ${page.error}`;
        }

        return [
          page.title
            ? `${page.title} — ${page.url}`
            : page.url,
          page.content?.slice(0, 12_000) ?? '',
        ].join('\n');
      })
      .join('\n\n---\n\n'),
  }),
});