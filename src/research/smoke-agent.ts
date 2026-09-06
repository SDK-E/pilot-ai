import { Agent } from '@mastra/core/agent';
import {
  webFetchTool,
} from '@mastra/core/tools';

import {
  pilotConfig,
} from '#research/runtime/config';

import { researchAgentIdentity } from './identity';

export const pilotResearchSmokeAgent =
  new Agent({
    id: 'pilot-research-smoke',

    name: `${researchAgentIdentity.name} Smoke`,

    description:
      'Minimal Pilot Research Agent used only for fast persisted smoke experiments.',

    instructions: `
You are the fast smoke-test version of ${researchAgentIdentity.name}.

Your job is only to verify that:
- the model works
- direct public URL fetching works
- a concise researched answer can be returned
- experiment scorers can inspect the final output

For the current smoke dataset:

Use this official source:
https://mastra.ai/docs/memory/observational-memory

Rules:
- use webFetchTool directly
- do not search for alternative sources
- do not perform broad research
- do not delegate
- do not ask questions
- use at most one fetch unless the first fetch fails
- answer concisely
- include the source URL
- finish immediately after answering
`.trim(),

    model: [
      {
        model:
          pilotConfig.model.id,

        maxRetries: 8,
      },
    ],

    defaultOptions: {
      maxSteps: 4,
    },

    tools: {
      webFetchTool,
    },
  });
