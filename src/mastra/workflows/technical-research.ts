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

const technicalResearchStep = createStep({
  id: 'technical-research',
  inputSchema,
  outputSchema,

  execute: async ({ inputData, mastra }) => {
    const query = inputData.query;

    const queries = [
      query,
      `${query} official documentation`,
      `${query} GitHub`,
      `${query} releases changelog`,
      `${query} npm package registry`,
      `${query} issues discussions`,
      `${query} examples`,
    ];

    const discovered = await searchMany(queries);

    const enriched = await Promise.all(
      discovered.slice(0, 14).map(async (source) => {
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
      ...discovered.slice(14),
    ]);

    const agent = mastra?.getAgent('pilotBrowser');

    if (!agent) {
      throw new Error('pilotBrowser agent not found');
    }

    const result = await agent.generate(`
Perform technical research for the user's request.

Do not invoke another workflow.
Use normal research tools only when the supplied evidence leaves an important
technical question unresolved.

User request:
${query}

Evidence:
${JSON.stringify(sources, null, 2)}

Evidence priority:
1. official documentation
2. source repository
3. releases and changelog
4. package registry
5. maintainers
6. issues and discussions
7. high-quality secondary sources

Requirements:
- verify current APIs and versions
- do not answer from remembered APIs when current documentation is available
- inspect repositories when implementation details matter
- distinguish documented behavior from observed implementation
- mention version-specific constraints
- identify deprecated or outdated approaches
- prefer existing maintained packages over unnecessary custom implementation
- cite source URLs
`);

    return {
      answer: result.text,
      sources,
    };
  },
});

export const technicalResearchWorkflow = createWorkflow({
  id: 'technical-research',
  inputSchema,
  outputSchema,
})
  .then(technicalResearchStep)
  .commit();