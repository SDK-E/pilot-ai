import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import {
  performLangSearch,
  searchResultSchema,
  type SearchResult,
} from '#runtime/tools/search/langsearch';
import { performUrlFetch } from '#runtime/tools/url-fetch';

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

const companyResearchStep = createStep({
  id: 'company-research',
  inputSchema,
  outputSchema,

  execute: async ({ inputData, mastra }) => {
    const query = inputData.query;

    const queries = [
      query,
      `${query} official company`,
      `${query} leadership team`,
      `${query} technology engineering`,
      `${query} hiring jobs`,
      `${query} latest news`,
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

    const agent = mastra?.getAgent('pilotResearchAgent');

    if (!agent) {
      throw new Error('pilotResearchAgent not found');
    }

    const result = await agent.generate(`
Research the company or companies relevant to this request.

Do not invoke another workflow.
Use additional tools only if an important company fact still needs verification.

User request:
${query}

Evidence:
${JSON.stringify(sources, null, 2)}

Build the answer around whichever of these are relevant:
- company identity
- official website
- products and services
- customers or markets
- current initiatives
- technology and engineering signals
- hiring signals
- leadership
- size or operating footprint
- recent developments
- commercial or strategic relevance
- evidence and confidence

Do not force irrelevant fields.
Do not guess.
Prefer official company sources for company facts.
`);

    return {
      answer: result.text,
      sources,
    };
  },
});

export const companyResearchWorkflow = createWorkflow({
  id: 'company-research',
  inputSchema,
  outputSchema,
})
  .then(companyResearchStep)
  .commit();
