import { createClient, type Client } from "@libsql/client";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  collectedResultSchema,
  type CollectedResult,
} from "../../schemas/collected-result.js";
import {
  developmentDatabaseAuthToken,
  developmentDatabaseUrl,
} from "../../storage/development-database.js";
import { createResultStore } from "../../storage/result-store.js";

const client: Client = createClient({
  url: developmentDatabaseUrl,
  authToken: developmentDatabaseAuthToken,
});

const resultStore = createResultStore({
  client,
  tableName: "pilot_results",
});

const { clearResults, getResult, listResults, removeResult, upsertResult } =
  resultStore;

function canonicalUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    url.hash = "";

    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ]) {
      url.searchParams.delete(key);
    }

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return value;
  }
}

function normalizeResult(result: CollectedResult): CollectedResult {
  return {
    ...result,

    url: canonicalUrl(result.url),

    sourceUrl: canonicalUrl(result.sourceUrl),

    contradictions: [...new Set(result.contradictions.filter(Boolean))],
  };
}

function identityKey(result: CollectedResult): string {
  if (result.url) {
    return `url:${canonicalUrl(result.url)}`;
  }

  const type = result.type?.trim().toLowerCase() ?? "";

  const name = (result.name ?? result.title ?? "").trim().toLowerCase();

  return `${type}:${name}`;
}

function confidenceRank(confidence?: CollectedResult["confidence"]): number {
  switch (confidence) {
    case "HIGH": {
      return 3;
    }

    case "MEDIUM": {
      return 2;
    }

    case "LOW": {
      return 1;
    }

    default: {
      return 0;
    }
  }
}

function mergeResults(
  current: CollectedResult,
  incoming: CollectedResult,
): CollectedResult {
  const isPreferIncoming =
    confidenceRank(incoming.confidence) >= confidenceRank(current.confidence);

  return normalizeResult({
    ...current,

    ...(isPreferIncoming
      ? incoming
      : {
          ...incoming,

          summary: current.summary ?? incoming.summary,

          sourceUrl: current.sourceUrl ?? incoming.sourceUrl,

          sourceType: current.sourceType ?? incoming.sourceType,

          confidence: current.confidence ?? incoming.confidence,

          verificationStatus:
            current.verificationStatus ?? incoming.verificationStatus,

          score: current.score ?? incoming.score,
        }),

    id: current.id,

    contradictions: [
      ...new Set([...current.contradictions, ...incoming.contradictions]),
    ],

    metadata: {
      ...current.metadata,
      ...incoming.metadata,
    },
  });
}

async function dedupeResults(threadId: string): Promise<CollectedResult[]> {
  const results = await listResults(threadId);

  const canonical = new Map<string, CollectedResult>();

  for (const result of results) {
    const key = identityKey(result);

    const existing = canonical.get(key);

    if (!existing) {
      canonical.set(key, normalizeResult(result));

      continue;
    }

    const merged = mergeResults(existing, result);

    canonical.set(key, merged);

    if (result.id !== merged.id) {
      await removeResult(threadId, result.id);
    }

    await upsertResult(threadId, merged);
  }

  return [...canonical.values()];
}

export const resultCollector = createTool({
  id: "result-collector",

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
      "read",
      "get",
      "add",
      "update",
      "remove",
      "dedupe",
      "clear",
    ]),

    result: collectedResultSchema.optional(),

    id: z.string().optional(),
  }),

  outputSchema: z.object({
    results: z.array(collectedResultSchema),

    result: collectedResultSchema.optional(),

    count: z.number().int(),
  }),

  execute: async (inputData, context) => {
    const threadId = context.agent?.threadId;

    if (!threadId) {
      throw new Error(
        "resultCollector requires an active Mastra memory thread.",
      );
    }

    switch (inputData.action) {
      case "read": {
        const results = await listResults(threadId);

        return {
          results,
          count: results.length,
        };
      }

      case "get": {
        if (!inputData.id) {
          throw new Error("id is required for get");
        }

        const result = await getResult(threadId, inputData.id);

        return {
          results: result ? [result] : [],

          result,

          count: result ? 1 : 0,
        };
      }

      case "add":
      case "update": {
        if (!inputData.result) {
          throw new Error(`result is required for ${inputData.action}`);
        }

        const incoming = normalizeResult(inputData.result);

        const existing = await getResult(threadId, incoming.id);

        const result = existing ? mergeResults(existing, incoming) : incoming;

        await upsertResult(threadId, result);

        return {
          results: [result],
          result,
          count: 1,
        };
      }

      case "remove": {
        if (!inputData.id) {
          throw new Error("id is required for remove");
        }

        await removeResult(threadId, inputData.id);

        const results = await listResults(threadId);

        return {
          results,
          count: results.length,
        };
      }

      case "dedupe": {
        const results = await dedupeResults(threadId);

        return {
          results,
          count: results.length,
        };
      }

      case "clear": {
        await clearResults(threadId);

        return {
          results: [],
          count: 0,
        };
      }
    }
  },

  toModelOutput: (output) => ({
    type: "text",

    value:
      output.count === 0
        ? "No persisted research results."
        : output.results
            .slice(0, 30)
            .map((result) =>
              [
                result.name ?? result.title ?? result.id,

                result.type ? `Type: ${result.type}` : undefined,

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
                .join("\n"),
            )
            .join("\n\n"),
  }),
});
