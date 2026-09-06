import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  researchResultSchema,
  type ResearchResult,
} from '../schemas/research-result';

const validationIssueSchema = z.object({
  resultId: z.string().optional(),

  severity: z.enum([
    'error',
    'warning',
  ]),

  field: z.string().optional(),

  message: z.string(),
});

function isUsefulResult(
  result: ResearchResult,
): boolean {
  return Boolean(
    result.name ||
      result.title ||
      result.summary ||
      result.url,
  );
}

function validateResult(
  result: ResearchResult,
): z.infer<
  typeof validationIssueSchema
>[] {
  const issues: z.infer<
    typeof validationIssueSchema
  >[] = [];

  if (!isUsefulResult(result)) {
    issues.push({
      resultId: result.id,
      severity: 'error',
      message:
        'Result contains no useful identifying or descriptive information.',
    });
  }

  if (
    result.verificationStatus ===
      'verified' &&
    !result.sourceUrl &&
    !result.url
  ) {
    issues.push({
      resultId: result.id,
      severity: 'warning',
      field: 'verificationStatus',
      message:
        'Result is marked verified but has no evidence URL.',
    });
  }

  if (
    result.confidence === 'HIGH' &&
    result.verificationStatus ===
      'unverified'
  ) {
    issues.push({
      resultId: result.id,
      severity: 'error',
      field: 'confidence',
      message:
        'HIGH confidence conflicts with unverified status.',
    });
  }

  if (
    result.verificationStatus ===
      'contradicted' &&
    result.contradictions.length === 0
  ) {
    issues.push({
      resultId: result.id,
      severity: 'warning',
      field: 'contradictions',
      message:
        'Result is marked contradicted but contains no contradiction details.',
    });
  }

  return issues;
}

function duplicateKeys(
  results: ResearchResult[],
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const result of results) {
    const key = (
      result.url ??
      `${result.type ?? ''}:${result.name ?? result.title ?? ''}`
    )
      .trim()
      .toLowerCase();

    if (!key) {
      continue;
    }

    if (seen.has(key)) {
      duplicates.add(key);
    }

    seen.add(key);
  }

  return [...duplicates];
}

export const exportValidator =
  createTool({
    id: 'export-validator',

    description: `
Validate structured research results before exporting them.

Use before CSV or Markdown export for non-trivial result sets.

Checks:
- malformed or empty results
- contradictory confidence/verification state
- missing evidence for verified claims
- duplicate results
- required fields requested by the user
`,

    inputSchema: z.object({
      results: z.array(
        researchResultSchema,
      ),

      requiredFields: z
        .array(z.string())
        .default([]),
    }),

    outputSchema: z.object({
      valid: z.boolean(),

      issues: z.array(
        validationIssueSchema,
      ),

      duplicateKeys:
        z.array(z.string()),

      count: z.number().int(),
    }),

    execute: async ({
      results,
      requiredFields,
    }) => {
      const issues =
        results.flatMap(
          validateResult,
        );

      for (const result of results) {
        const record =
          result as Record<
            string,
            unknown
          >;

        for (const field of requiredFields) {
          const value = record[field];

          if (
            value === undefined ||
            value === null ||
            value === ''
          ) {
            issues.push({
              resultId: result.id,
              severity: 'warning',
              field,
              message:
                `Requested field "${field}" is missing.`,
            });
          }
        }
      }

      const duplicates =
        duplicateKeys(results);

      for (const key of duplicates) {
        issues.push({
          severity: 'error',
          message:
            `Duplicate export entity detected: ${key}`,
        });
      }

      return {
        valid: !issues.some(
          (issue) =>
            issue.severity ===
            'error',
        ),

        issues,

        duplicateKeys:
          duplicates,

        count: results.length,
      };
    },

    toModelOutput: (output) => ({
      type: 'text',

      value: output.valid
        ? `Export validation passed for ${output.count} results.`
        : [
            `Export validation failed for ${output.count} results.`,

            ...output.issues.map(
              (issue) =>
                `[${issue.severity.toUpperCase()}] ${
                  issue.resultId
                    ? `${issue.resultId}: `
                    : ''
                }${issue.message}`,
            ),
          ].join('\n'),
    }),
  });