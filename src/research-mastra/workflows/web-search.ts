import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import {
  performLangSearch,
  searchResultSchema,
} from '../tools/langsearch';

const inputSchema = z.object({
  query: z.string().min(1),
});

const outputSchema = z.object({
  answer: z.string(),
  sources: z.array(searchResultSchema),
});

const searchStep = createStep({
  id: 'web-search-search',
  inputSchema,
  outputSchema,

  execute: async ({ inputData, mastra }) => {
    const sources = await performLangSearch(inputData.query, 8);

    const agent = mastra?.getAgent('pilotResearchAgent');

    if (!agent) {
      throw new Error('pilotResearchAgent not found');
    }

    const result = await agent.generate(`
Answer the user's research request using the supplied search results.

Do not invoke another workflow.
You may use your normal research tools only if the supplied evidence is insufficient.

User request:
${inputData.query}

Search results:
${JSON.stringify(sources, null, 2)}

Requirements:
- answer the actual intended question
- prefer current and primary evidence
- distinguish facts from inference
- include useful source URLs
- do not fabricate missing information
`);

    return {
      answer: result.text,
      sources,
    };
  },
});

export const webSearchWorkflow = createWorkflow({
  id: 'web-search',
  inputSchema,
  outputSchema,
})
  .then(searchStep)
  .commit();
