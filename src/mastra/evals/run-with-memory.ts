import { randomUUID } from 'node:crypto';

import {
  runEvals,
  type ScorerEntry,
} from '@mastra/core/evals';
import type {
  MastraScorer,
} from '@mastra/core/evals';

import { pilotBrowser } from '../agents/pilot-browser';

const EVAL_RESOURCE_ID =
  'pilot-browser-evals';

type PilotEvalDataItem = {
  input: string;
  groundTruth?: unknown;
};

type PilotEvalOptions = {
  data: PilotEvalDataItem[];

  gates?: MastraScorer<
    any,
    any,
    any,
    any
  >[];

  scorers?: ScorerEntry[];

  concurrency?: number;

  onItemComplete?: (params: {
    item: unknown;
    targetResult: unknown;
    scorerResults: Record<
      string,
      unknown
    >;
  }) => void | Promise<void>;
};

export async function runPilotEvals(
  options: PilotEvalOptions,
) {
  const threadId =
    `pilot-eval-${randomUUID()}`;

  const memory =
    await pilotBrowser.getMemory();

  if (!memory) {
    throw new Error(
      'Pilot Browser memory is not configured.',
    );
  }

  await memory.createThread({
    threadId,
    resourceId: EVAL_RESOURCE_ID,
    title: `Pilot eval ${threadId}`,
  });

  const targetOptions = {
    memory: {
      thread: threadId,
      resource: EVAL_RESOURCE_ID,
    },
  };

  if (
    options.gates &&
    options.gates.length > 0
  ) {
    return runEvals({
      data: options.data,

      target: pilotBrowser,

      targetOptions,

      gates: options.gates,

      scorers:
        options.scorers,

      concurrency:
        options.concurrency,

      onItemComplete:
        options.onItemComplete as any,
    });
  }

  if (
    options.scorers &&
    options.scorers.length > 0
  ) {
    return runEvals({
      data: options.data,

      target: pilotBrowser,

      targetOptions,

      scorers:
        options.scorers,

      concurrency:
        options.concurrency,

      onItemComplete:
        options.onItemComplete as any,
    });
  }

  throw new Error(
    'Pilot eval requires at least one scorer or gate.',
  );
}