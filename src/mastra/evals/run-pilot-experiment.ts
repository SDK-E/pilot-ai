import {
  randomUUID,
} from 'node:crypto';

import {
  pilotBrowser,
} from '../agents/pilot-browser';

import {
  pilotConfig,
} from '../config';

import {
  mastra,
} from '../index';

import {
  resolvePilotEvalMode,
  type PilotEvalMode,
} from './pilot-dataset';

import {
  seedPilotDataset,
} from './seed-pilot-dataset';

const SMOKE_TIMEOUT_MS =
  50_000;

const SMOKE_AGENT_TIMEOUT_MS =
  45_000;

const SMOKE_MAX_STEPS =
  4;

const REGRESSION_TIMEOUT_MS =
  120_000;

const SMOKE_RESOURCE_ID =
  'pilot-smoke-eval';

function resolveTimeout(
  mode: PilotEvalMode,
): number {
  if (
    mode === 'smoke'
  ) {
    return Math.min(
      pilotConfig.eval.timeoutMs,
      SMOKE_TIMEOUT_MS,
    );
  }

  if (
    mode === 'regression'
  ) {
    return Math.min(
      pilotConfig.eval.timeoutMs,
      REGRESSION_TIMEOUT_MS,
    );
  }

  return pilotConfig.eval
    .timeoutMs;
}

function resolveScorers(
  mode: PilotEvalMode,
): string[] {
  if (
    mode === 'smoke'
  ) {
    return [
      'pilot-source-coverage',
      'pilot-task-completion',
    ];
  }

  return [
    'answer-relevancy-scorer',
    'completeness-scorer',
    'pilot-source-coverage',
    'pilot-task-completion',
  ];
}

async function runSmokeTask(
  input: unknown,
): Promise<string> {
  const threadId =
    `pilot-smoke-${randomUUID()}`;

  const memory =
    await pilotBrowser.getMemory();

  if (memory) {
    await memory.createThread({
      threadId,
      resourceId:
        SMOKE_RESOURCE_ID,
      title:
        'Pilot smoke experiment',
    });
  }

  const originalInput =
    typeof input === 'string'
      ? input
      : JSON.stringify(input);

  const prompt = `
This is a strict fast smoke test.

Original objective:
${originalInput}

Use exactly this official source:
https://mastra.ai/docs/memory/observational-memory

Rules:
- fetch that URL directly
- do not search the web
- do not use site discovery
- do not delegate to another agent
- do not perform broad research
- return a concise answer
- include the source URL
- finish immediately after verifying the page
`.trim();

  const result =
    await pilotBrowser.generate(
      prompt,
      {
        maxSteps:
          SMOKE_MAX_STEPS,

        activeTools: [
          'webFetchTool',
        ],

        inputProcessors: [],

        outputProcessors: [],

        delegation: {
          onDelegationStart:
            () => ({
              proceed: false,
              rejectionReason:
                'Subagent delegation is disabled during the fast smoke experiment.',
            }),
        },

        abortSignal:
          AbortSignal.timeout(
            SMOKE_AGENT_TIMEOUT_MS,
          ),

        memory: {
          thread:
            threadId,

          resource:
            SMOKE_RESOURCE_ID,
        },
      },
    );

  return result.text;
}

async function runSmokeExperiment(
  dataset: Awaited<
    ReturnType<
      typeof seedPilotDataset
    >
  >,
) {
  return dataset.startExperiment({
    name:
      `pilot-browser-smoke-${new Date().toISOString()}`,

    description:
      'Fast Pilot Browser smoke experiment with direct fetch, no delegation, no expensive processors, and deterministic scoring.',

    metadata: {
      mode: 'smoke',
      profile:
        pilotConfig.profile,
    },

    task: async ({
      input,
    }) =>
      runSmokeTask(
        input,
      ),

    scorers:
      resolveScorers(
        'smoke',
      ),

    maxConcurrency: 1,

    itemTimeout:
      resolveTimeout(
        'smoke',
      ),

    maxRetries: 0,
  });
}

async function runStandardExperiment(
  dataset: Awaited<
    ReturnType<
      typeof seedPilotDataset
    >
  >,
  mode: Exclude<
    PilotEvalMode,
    'smoke'
  >,
) {
  return dataset.startExperiment({
    targetType:
      'agent',

    targetId:
      'pilot-browser',

    name:
      `pilot-browser-${mode}-${new Date().toISOString()}`,

    description:
      `Pilot Browser ${mode} experiment.`,

    metadata: {
      mode,
      profile:
        pilotConfig.profile,
    },

    scorers:
      resolveScorers(
        mode,
      ),

    maxConcurrency:
      pilotConfig.eval
        .concurrency,

    itemTimeout:
      resolveTimeout(
        mode,
      ),

    maxRetries:
      pilotConfig.eval
        .maxRetries,
  });
}

export async function runPilotExperiment() {
  const mode =
    resolvePilotEvalMode();

  const dataset =
    await seedPilotDataset(
      mastra,
      mode,
    );

  if (
    mode === 'smoke'
  ) {
    return runSmokeExperiment(
      dataset,
    );
  }

  return runStandardExperiment(
    dataset,
    mode,
  );
}