import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  researchResultSchema,
  type ResearchResult,
} from '../schemas/research-result';

import {
  clearResearchResults,
  getResearchResult,
  listResearchResults,
  removeResearchResult,
  upsertResearchResult,
} from '../storage/research-result-store';

function canonicalUrl(
  value?: string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    url.hash = '';

    for (const key of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
    ]) {
      url.searchParams.delete(key);
    }

    if (url.pathname !== '/') {
      url.pathname =
        url.pathname.replace(/\/+$/, '');
    }

    return url.toString();
  } catch {
    return value;
  }
}

function normalizeResult(
  result: ResearchResult,
): ResearchResult {
  return {
    ...result,

    url: canonicalUrl(result.url),

    sourceUrl: canonicalUrl(
      result.sourceUrl,
    ),

    contradictions: [
      ...new Set(
        result.contradictions.filter(Boolean),
      ),
    ],
  };
}

function identityKey(
  result: ResearchResult,
): string {
  if (result.url) {
    return `url:${canonicalUrl(result.url)}`;
  }

  const type =
    result.type?.trim().toLowerCase() ?? '';

  const name = (
    result.name ??
    result.title ??
    ''
  )
    .trim()
    .toLowerCase();

  return `${type}:${name}`;
}

function confidenceRank(
  confidence?: ResearchResult['confidence'],
): number {
  switch (confidence) {
    case 'HIGH':
      return 3;

    case 'MEDIUM':
      return 2;

    case 'LOW':
      return 1;

    default:
      return 0;
  }
}

function mergeResults(
  current: ResearchResult,
  incoming: ResearchResult,
): ResearchResult {
  const preferIncoming =
    confidenceRank(incoming.confidence) >=
    confidenceRank(current.confidence);

  return normalizeResult({
    ...current,

    ...(preferIncoming
      ? incoming
      : {
          ...incoming,

          summary:
            current.summary ??
            incoming.summary,

          sourceUrl:
            current.sourceUrl ??
            incoming.sourceUrl,

          sourceType:
            current.sourceType ??
            incoming.sourceType,

          confidence:
            current.confidence ??
            incoming.confidence,

          verificationStatus:
            current.verificationStatus ??
            incoming.verificationStatus,

          score:
            current.score ??
            incoming.score,
        }),

    id: current.id,

    contradictions: [
      ...new Set([
        ...current.contradictions,
        ...incoming.contradictions,
      ]),
    ],

    metadata: {
      ...current.metadata,
      ...incoming.metadata,
    },
  });
}

async function dedupeResults(
  threadId: string,
): Promise<ResearchResult[]> {
  const results =
    await listResearchResults(threadId);

  const canonical =
    new Map<string, ResearchResult>();

  for (const result of results) {
    const key = identityKey(result);

    const existing = canonical.get(key);

    if (!existing) {
      canonical.set(
        key,
        normalizeResult(result),
      );

      continue;
    }

    const merged = mergeResults(
      existing,
      result,
    );

    canonical.set(key, merged);

    if (result.id !== merged.id) {
      await removeResearchResult(
        threadId,
        result.id,
      );
    }

    await upsertResearchResult(
      threadId,
      merged,
    );
  }

  return [...canonical.values()];
}

export const resultCollector = createTool({
  id: 'result-collector',

  description: `
Persist structured research results for the current Pilot Research Agent thread.

Use this as the durable source of truth for accepted research results.

Results survive:
- agent turns
- server restarts
- process restarts

Use working memory only for compact summaries and continuation state.
Do not duplicate large structured result sets into working memory.
`,

  inputSchema: z.object({
    action: z.enum([
      'read',
      'get',
      'add',
      'update',
      'remove',
      'dedupe',
      'clear',
    ]),

    result:
      researchResultSchema.optional(),

    id: z.string().optional(),
  }),

  outputSchema: z.object({
    results: z.array(
      researchResultSchema,
    ),

    result:
      researchResultSchema.optional(),

    count: z.number().int(),
  }),

  execute: async (
    inputData,
    context,
  ) => {
    const threadId =
      context.agent?.threadId;

    if (!threadId) {
      throw new Error(
        'resultCollector requires an active Mastra memory thread.',
      );
    }

    switch (inputData.action) {
      case 'read': {
        const results =
          await listResearchResults(
            threadId,
          );

        return {
          results,
          count: results.length,
        };
      }

      case 'get': {
        if (!inputData.id) {
          throw new Error(
            'id is required for get',
          );
        }

        const result =
          await getResearchResult(
            threadId,
            inputData.id,
          );

        return {
          results: result
            ? [result]
            : [],

          result,

          count: result ? 1 : 0,
        };
      }

      case 'add':
      case 'update': {
        if (!inputData.result) {
          throw new Error(
            `result is required for ${inputData.action}`,
          );
        }

        const incoming =
          normalizeResult(
            inputData.result,
          );

        const existing =
          await getResearchResult(
            threadId,
            incoming.id,
          );

        const result = existing
          ? mergeResults(
              existing,
              incoming,
            )
          : incoming;

        await upsertResearchResult(
          threadId,
          result,
        );

        return {
          results: [result],
          result,
          count: 1,
        };
      }

      case 'remove': {
        if (!inputData.id) {
          throw new Error(
            'id is required for remove',
          );
        }

        await removeResearchResult(
          threadId,
          inputData.id,
        );

        const results =
          await listResearchResults(
            threadId,
          );

        return {
          results,
          count: results.length,
        };
      }

      case 'dedupe': {
        const results =
          await dedupeResults(
            threadId,
          );

        return {
          results,
          count: results.length,
        };
      }

      case 'clear': {
        await clearResearchResults(
          threadId,
        );

        return {
          results: [],
          count: 0,
        };
      }
    }
  },

  toModelOutput: (output) => ({
    type: 'text',

    value:
      output.count === 0
        ? 'No persisted research results.'
        : output.results
            .slice(0, 30)
            .map((result) =>
              [
                result.name ??
                  result.title ??
                  result.id,

                result.type
                  ? `Type: ${result.type}`
                  : undefined,

                result.url,

                result.summary,

                result.confidence
                  ? `Confidence: ${result.confidence}`
                  : undefined,

                result.verificationStatus
                  ? `Verification: ${result.verificationStatus}`
                  : undefined,
              ]
                .filter(Boolean)
                .join('\n'),
            )
            .join('\n\n'),
  }),
});
