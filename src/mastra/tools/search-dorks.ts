import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  performLangSearch,
  searchResultSchema,
} from './langsearch';

const dorkSearchResultSchema = z.object({
  query: z.string(),
  results: z.array(searchResultSchema),
});

function quote(value: string): string {
  const escaped = value
    .trim()
    .replaceAll('"', '\\"');

  return `"${escaped}"`;
}

function normalize(values?: string[]): string[] {
  return [
    ...new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function extractSites(rawQuery?: string): {
  query: string;
  sites: string[];
} {
  const raw = rawQuery?.trim() ?? '';
  const sites: string[] = [];

  const query = raw
    .replace(
      /(?:^|\s)site:([^\s()]+)/gi,
      (_match, site: string) => {
        sites.push(site.trim());
        return ' ';
      },
    )
    .replace(/\s+/g, ' ')
    .trim();

  return {
    query,
    sites: normalize(sites),
  };
}

function buildBaseQuery(input: {
  terms?: string[];
  exactPhrases?: string[];
  anyOf?: string[];
  exclude?: string[];
  inTitle?: string[];
  inUrl?: string[];
  fileTypes?: string[];
  after?: string;
  before?: string;
}): string {
  const parts: string[] = [];

  parts.push(...normalize(input.terms));
  parts.push(
    ...normalize(input.exactPhrases).map(quote),
  );

  const anyOf = normalize(input.anyOf);
  if (anyOf.length > 0) {
    parts.push(
      `(${anyOf.map(quote).join(' OR ')})`,
    );
  }

  parts.push(
    ...normalize(input.exclude).map(
      (value) => `-${quote(value)}`,
    ),
  );

  parts.push(
    ...normalize(input.inTitle).map(
      (value) => `intitle:${quote(value)}`,
    ),
  );

  parts.push(
    ...normalize(input.inUrl).map(
      (value) => `inurl:${quote(value)}`,
    ),
  );

  parts.push(
    ...normalize(input.fileTypes).map(
      (value) =>
        `filetype:${value.replace(/^\./, '')}`,
    ),
  );

  if (input.after) {
    parts.push(`after:${input.after}`);
  }

  if (input.before) {
    parts.push(`before:${input.before}`);
  }

  return parts.join(' ').trim();
}

function buildQueries(input: {
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
  maxQueries: number;
}): string[] {
  const extracted = extractSites(input.rawQuery);

  const base = extracted.query ||
    buildBaseQuery(input);

  if (!base) {
    return [];
  }

  const sites = normalize([
    ...extracted.sites,
    ...normalize(input.sites),
  ]);

  if (sites.length === 0) {
    return [base];
  }

  return sites
    .map((site) => `${base} site:${site}`)
    .slice(0, input.maxQueries);
}

export const searchDorks = createTool({
  id: 'search-dorks',

  description:
    'Build and execute precise public-web search dorks. Use for targeted discovery with site:, intitle:, inurl:, filetype:, exact phrases, exclusions, OR groups, and date bounds. Multiple site: operators are automatically split into separate search branches instead of being ANDed into an impossible query. This searches the public web; it is not an internal tool-discovery function.',

  inputSchema: z.object({
    rawQuery: z
      .string()
      .min(1)
      .optional(),

    terms: z
      .array(z.string().min(1))
      .default([]),

    exactPhrases: z
      .array(z.string().min(1))
      .default([]),

    anyOf: z
      .array(z.string().min(1))
      .default([]),

    exclude: z
      .array(z.string().min(1))
      .default([]),

    sites: z
      .array(z.string().min(1))
      .default([]),

    inTitle: z
      .array(z.string().min(1))
      .default([]),

    inUrl: z
      .array(z.string().min(1))
      .default([]),

    fileTypes: z
      .array(z.string().min(1))
      .default([]),

    after: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),

    before: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),

    maxQueries: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5),

    maxResultsPerQuery: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5),
  }),

  outputSchema: z.object({
    queries: z.array(z.string()),
    searches: z.array(dorkSearchResultSchema),
  }),

  execute: async (
    input,
    {
      abortSignal,
    },
  ) => {
    const queries = buildQueries(input);

    if (queries.length === 0) {
      throw new Error(
        'At least one rawQuery, term, exact phrase, or other searchable condition is required.',
      );
    }

    const settled =
      await Promise.allSettled(
        queries.map(async (query) => ({
          query,
          results:
            await performLangSearch(
              query,
              input.maxResultsPerQuery,
              abortSignal,
            ),
        })),
      );

    const searches = settled.map(
      (result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }

        return {
          query: queries[index]!,
          results: [],
        };
      },
    );

    return {
      queries,
      searches,
    };
  },

  toModelOutput: (output) => ({
    type: 'text',
    value: output.searches
      .map((search) => [
        `Query: ${search.query}`,
        search.results.length === 0
          ? 'No results.'
          : search.results
              .map(
                (result, index) =>
                  `${index + 1}. ${result.title}\n${result.url}\n${result.snippet ?? result.content ?? ''}`,
              )
              .join('\n\n'),
      ].join('\n'))
      .join('\n\n---\n\n'),
  }),
});
