import {
  webFetchTool,
} from '@mastra/core/tools';

import {
  pilotConfig,
} from '#runtime/research/config';

import { researchAgentIdentity } from './identity';
import { createBaseAgent } from '#runtime/agent/base-agent';
import { buildBaseAgentInstructions } from '#runtime/agent/base-instructions';

export const pilotResearchSmokeAgent =
  createBaseAgent({
    base: {
      maxSteps: 4,
      tokenLimit: 12_000,
      warningAt: 2,
      finalAt: 3,
    },
    id: 'pilot-research-smoke',

    name: `${researchAgentIdentity.name} Smoke`,

    description:
      'Minimal Pilot Research Agent used only for fast persisted smoke experiments.',

    instructions: [
      buildBaseAgentInstructions(researchAgentIdentity),
      `
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
    ].join('\n\n'),

    model: [
      {
        model:
          pilotConfig.model.id,

        maxRetries: 8,
      },
    ],

    tools: {
      webFetchTool,
    },
  });
