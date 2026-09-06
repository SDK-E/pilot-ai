import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  researchResultSchema,
  type ResearchResult,
} from '../schemas/research-result';

function sanitizeFilename(
  value: string,
): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function csvEscape(
  value: unknown,
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  const text =
    typeof value === 'string'
      ? value
      : JSON.stringify(value);

  if (
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n')
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function csvResults(
  results: ResearchResult[],
): string {
  const columns = [
    'id',
    'type',
    'name',
    'title',
    'url',
    'summary',
    'sourceUrl',
    'sourceType',
    'observedAt',
    'publishedAt',
    'confidence',
    'verificationStatus',
    'score',
    'contradictions',
    'metadata',
  ] as const;

  const lines = [
    columns.join(','),
  ];

  for (const result of results) {
    lines.push(
      columns
        .map((column) =>
          csvEscape(result[column]),
        )
        .join(','),
    );
  }

  return lines.join('\n');
}

function markdownResults(
  results: ResearchResult[],
): string {
  return results
    .map((result) => {
      const heading =
        result.name ??
        result.title ??
        result.id;

      return [
        `## ${heading}`,

        result.type
          ? `**Type:** ${result.type}`
          : undefined,

        result.url
          ? `**URL:** ${result.url}`
          : undefined,

        result.summary,

        result.sourceUrl
          ? `**Source:** ${result.sourceUrl}`
          : undefined,

        result.confidence
          ? `**Confidence:** ${result.confidence}`
          : undefined,

        result.verificationStatus
          ? `**Verification:** ${result.verificationStatus}`
          : undefined,

        result.contradictions.length
          ? [
              '**Contradictions:**',
              ...result.contradictions.map(
                (item) =>
                  `- ${item}`,
              ),
            ].join('\n')
          : undefined,
      ]
        .filter(Boolean)
        .join('\n\n');
    })
    .join('\n\n---\n\n');
}

export const exportResults =
  createTool({
    id: 'export-results',

    description:
      'Export validated structured research results as CSV or Markdown.',

    inputSchema: z.object({
      format: z.enum([
        'csv',
        'markdown',
      ]),

      filename: z
        .string()
        .min(1)
        .default('pilot-research'),

      results: z.array(
        researchResultSchema,
      ),
    }),

    outputSchema: z.object({
      filename: z.string(),
      content: z.string(),
      count: z.number().int(),
    }),

    execute: async ({
      format,
      filename,
      results,
    }) => {
      const base =
        sanitizeFilename(filename) ||
        'pilot-research';

      const extension =
        format === 'csv'
          ? 'csv'
          : 'md';

      const content =
        format === 'csv'
          ? csvResults(results)
          : markdownResults(results);

      return {
        filename:
          `${base}.${extension}`,

        content,

        count: results.length,
      };
    },

    toModelOutput: (output) => ({
      type: 'text',

      value:
        `Exported ${output.count} results to ${output.filename}.`,
    }),
  });