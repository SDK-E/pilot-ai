import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const csvValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const csvRowSchema = z.record(
  z.string(),
  csvValueSchema,
);

function sanitizeFilename(
  value: string,
): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!sanitized) {
    return 'pilot-export.csv';
  }

  return sanitized.toLowerCase().endsWith('.csv')
    ? sanitized
    : `${sanitized}.csv`;
}

function protectFormula(
  value: string,
): string {
  return /^[=+\-@]/.test(value)
    ? `'${value}`
    : value;
}

function escapeCell(
  value: string | number | boolean | null,
  protectFormulas: boolean,
): string {
  if (value === null) {
    return '';
  }

  const raw = String(value);
  const safe =
    protectFormulas
      ? protectFormula(raw)
      : raw;

  if (
    safe.includes(',') ||
    safe.includes('"') ||
    safe.includes('\n') ||
    safe.includes('\r')
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

function inferColumns(
  rows: Array<Record<string, string | number | boolean | null>>,
): string[] {
  const columns = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key);
    }
  }

  return [...columns];
}

export const csvFile = createTool({
  id: 'csv-file',

  description:
    'Create a CSV file from arbitrary structured rows. Use when the user asks for CSV output, tabular export, lead lists, research tables, or spreadsheet-friendly data.',

  inputSchema: z.object({
    filename: z
      .string()
      .min(1)
      .default('pilot-export.csv'),

    columns: z
      .array(z.string().min(1))
      .optional(),

    rows: z.array(csvRowSchema),

    protectFormulas: z
      .boolean()
      .default(true),
  }),

  outputSchema: z.object({
    filename: z.string(),
    content: z.string(),
    rowCount: z.number().int(),
    columns: z.array(z.string()),
  }),

  execute: async ({
    filename,
    columns,
    rows,
    protectFormulas,
  }) => {
    const resolvedColumns =
      columns?.length
        ? columns
        : inferColumns(rows);

    const lines = [
      resolvedColumns
        .map((column) =>
          escapeCell(
            column,
            false,
          ),
        )
        .join(','),
    ];

    for (const row of rows) {
      lines.push(
        resolvedColumns
          .map((column) =>
            escapeCell(
              row[column] ?? null,
              protectFormulas,
            ),
          )
          .join(','),
      );
    }

    return {
      filename:
        sanitizeFilename(filename),
      content:
        lines.join('\n'),
      rowCount:
        rows.length,
      columns:
        resolvedColumns,
    };
  },

  toModelOutput: (output) => ({
    type: 'text',
    value:
      `Created ${output.filename} with ${output.rowCount} rows and ${output.columns.length} columns.`,
  }),
});