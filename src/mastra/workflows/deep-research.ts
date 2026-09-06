import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import {
  performLangSearch,
  searchResultSchema,
  type SearchResult,
} from '../tools/langsearch';
import { performUrlFetch } from '../tools/url-fetch';

const inputSchema = z.object({
  query: z.string().min(1),
});

const outputSchema = z.object({
  answer: z.string(),
  sources: z.array(searchResultSchema),
});

function dedupe(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();

  return results.filter((result) => {
    if (!result.url || seen.has(result.url)) {
      return false;
    }

    seen.add(result.url);
    return true;
  });
}

async function searchMany(queries: string[]): Promise<SearchResult[]> {
  const settled = await Promise.allSettled(
    queries.map((query) => performLangSearch(query, 8)),
  );

  return dedupe(
    settled.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    ),
  );
}

const researchStep = createStep({
  id: 'deep-research',
  inputSchema,
  outputSchema,

  execute: async ({ inputData, mastra }) => {
    const query = inputData.query;

    const queries = [
      query,
      `${query} latest`,
      `${query} official`,
      `${query} analysis`,
      `${query} documentation sources`,
    ];

    const discovered = await searchMany(queries);

    const enriched = await Promise.all(
      discovered.slice(0, 12).map(async (source) => {
        try {
          const page = await performUrlFetch(source.url);

          return {
            ...source,
            content: page.content,
          };
        } catch {
          return source;
        }
      }),
    );

    const sources = dedupe([
      ...enriched,
      ...discovered.slice(12),
    ]);

    const agent = mastra?.getAgent('pilotBrowser');

    if (!agent) {
      throw new Error('pilotBrowser agent not found');
    }

    const result = await agent.generate(`
Perform a deep synthesis for this request.

Do not invoke another workflow.
The discovery and page retrieval phase has already been performed.
Use your normal tools only when a material evidence gap remains.

User request:
${query}

Evidence:
${JSON.stringify(sources, null, 2)}

Requirements:
- infer the actual intended outcome
- connect related entities instead of stopping at intermediate findings
- prioritize primary and recent evidence
- reconcile conflicting claims
- distinguish verified facts from inference
- identify meaningful gaps
- produce the useful result, not a diary of the research process
- cite source URLs
`);

    return {
      answer: result.text,
      sources,
    };
  },
});

export const deepResearchWorkflow = createWorkflow({
  id: 'deep-research',
  inputSchema,
  outputSchema,
})
  .then(researchStep)
  .commit();