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

const peopleResearchStep = createStep({
  id: 'people-research',
  inputSchema,
  outputSchema,

  execute: async ({ inputData, mastra }) => {
    const query = inputData.query;

    const queries = [
      query,
      `${query} LinkedIn`,
      `${query} company leadership`,
      `${query} professional profile`,
      `${query} contact`,
      `${query} email phone`,
    ];

    const discovered = await searchMany(queries);

    const enriched = await Promise.all(
      discovered.slice(0, 10).map(async (source) => {
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
      ...discovered.slice(10),
    ]);

    const agent = mastra?.getAgent('pilotBrowser');

    if (!agent) {
      throw new Error('pilotBrowser agent not found');
    }

    const result = await agent.generate(`
Research the people relevant to the user's intended objective.

Do not invoke another workflow.
You may continue with normal research tools when needed to verify identity,
current role, company relationship, or explicitly public professional contact
information.

User request:
${query}

Evidence:
${JSON.stringify(sources, null, 2)}

Requirements:
- verify that each person is the correct individual
- verify their current company and role when possible
- identify why they are relevant to the user's objective
- distinguish direct decision makers from adjacent people
- include LinkedIn or other public professional profiles when available
- include work email addresses or business phone numbers only when explicitly public and verifiable
- never generate or infer private contact details
- prefer company pages and first-party professional sources
- explain uncertainty when identity or role cannot be verified
`);

    return {
      answer: result.text,
      sources,
    };
  },
});

export const peopleResearchWorkflow = createWorkflow({
  id: 'people-research',
  inputSchema,
  outputSchema,
})
  .then(peopleResearchStep)
  .commit();