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
    queries.map((query) => performLangSearch(query, 10)),
  );

  return dedupe(
    settled.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    ),
  );
}

const leadResearchStep = createStep({
  id: 'lead-research',
  inputSchema,
  outputSchema,

  execute: async ({ inputData, mastra }) => {
    const query = inputData.query;

    const queries = [
      query,
      `${query} hiring`,
      `${query} jobs`,
      `${query} engineering hiring`,
      `${query} technology initiative`,
      `${query} company expansion`,
      `${query} leadership CTO VP Engineering`,
      `${query} decision maker LinkedIn`,
      `${query} contact email phone`,
    ];

    const discovered = await searchMany(queries);

    const enriched = await Promise.all(
      discovered.slice(0, 16).map(async (source) => {
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
      ...discovered.slice(16),
    ]);

    const agent = mastra?.getAgent('pilotBrowser');

    if (!agent) {
      throw new Error('pilotBrowser agent not found');
    }

    const result = await agent.generate(`
Build commercial leads from the evidence according to the user's actual intent.

Do not invoke another workflow.
Use your normal research tools when additional enrichment or verification
would materially improve a promising lead.

User request:
${query}

Initial evidence:
${JSON.stringify(sources, null, 2)}

IMPORTANT:

A job advertisement or hiring signal is not the final lead.

Follow useful relationships such as:

JOB
→ COMPANY
→ CURRENT TECHNICAL NEED
→ COMMERCIAL RELEVANCE
→ RELEVANT DECISION MAKER
→ PUBLIC PROFESSIONAL CONTACT INFORMATION

For SDK Enterprises-related requests, determine whether the observed need could
reasonably relate to software engineering, platform modernization, AI,
automation, cloud, data, APIs, systems engineering, or adjacent engineering
services.

For each useful lead, attempt to establish:
- company
- website
- current signal
- evidence date when available
- actual or likely technical need, clearly marked when inferred
- commercial relevance
- appropriate decision maker or superior
- current title
- LinkedIn/public professional profile
- explicitly public work email
- explicitly public business phone
- company contact page when useful
- evidence URLs
- confidence

Do not guess email formats.
Do not generate phone numbers.
Do not invent decision makers.

Deduplicate companies and people.

Rank stronger, current, actionable opportunities above weak signals.

If the user requested an export, use exportResults before completing.
`);

    return {
      answer: result.text,
      sources,
    };
  },
});

export const leadResearchWorkflow = createWorkflow({
  id: 'lead-research',
  inputSchema,
  outputSchema,
})
  .then(leadResearchStep)
  .commit();