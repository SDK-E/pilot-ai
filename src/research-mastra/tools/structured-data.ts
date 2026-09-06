import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const structuredDataItemSchema = z.object({
  type: z.string().optional(),
  data: z.unknown(),
});

type StructuredDataOutput = {
  url: string;
  items: Array<{
    type?: string;
    data: unknown;
  }>;
};

function flattenJsonLd(
  value: unknown,
): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (
    value &&
    typeof value === 'object' &&
    '@graph' in value &&
    Array.isArray(
      (value as { '@graph'?: unknown[] })['@graph'],
    )
  ) {
    return (
      value as { '@graph': unknown[] }
    )['@graph'].flatMap(flattenJsonLd);
  }

  return [value];
}

function getType(
  value: unknown,
): string | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('@type' in value)
  ) {
    return undefined;
  }

  const type = (value as { '@type'?: unknown })[
    '@type'
  ];

  if (Array.isArray(type)) {
    return type
      .filter(
        (item): item is string =>
          typeof item === 'string',
      )
      .join(', ');
  }

  return typeof type === 'string'
    ? type
    : undefined;
}

export const structuredData = createTool({
  id: 'structured-data',

  description:
    'Extract JSON-LD structured data from a public webpage. Useful for organizations, people, jobs, products, events, articles, addresses, and other structured facts.',

  inputSchema: z.object({
    url: z.string().url(),
  }),

  outputSchema: z.object({
    url: z.string(),
    items: z.array(structuredDataItemSchema),
  }),

  execute: async (
    { url },
    { abortSignal },
  ): Promise<StructuredDataOutput> => {
    const response = await fetch(url, {
      signal: abortSignal,

      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; PilotResearch/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status}`,
      );
    }

    const html = await response.text();

    const items: StructuredDataOutput['items'] =
      [];

    const pattern =
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(pattern)) {
      const raw = match[1]?.trim();

      if (!raw) {
        continue;
      }

      try {
        const parsed: unknown =
          JSON.parse(raw);

        for (const value of flattenJsonLd(
          parsed,
        )) {
          items.push({
            type: getType(value),
            data: value,
          });
        }
      } catch {
        // Ignore malformed JSON-LD.
      }
    }

    return {
      url,
      items,
    };
  },

  toModelOutput: (output) => ({
    type: 'text',
    value: JSON.stringify(
      output.items,
      null,
      2,
    ).slice(0, 60_000),
  }),
});