import { randomUUID } from 'node:crypto';

import {
  runEvals,
  type ScorerEntry,
} from '@mastra/core/evals';

import type {
  MastraScorer,
} from '@mastra/core/evals';

import { pilotResearchAgent } from '../agent';

import { pilotConfig } from '#runtime/research/config';

const EVAL_RESOURCE_ID =
  'pilot-research-evals';

type PilotEvalDataItem = {
  input: string;
  groundTruth?: unknown;
};

type PilotEvalOptions = {
  data:
    PilotEvalDataItem[];

  gates?: MastraScorer<
    any,
    any,
    any,
    any
  >[];

  scorers?:
    ScorerEntry[];

  concurrency?:
    number;

  onItemComplete?: (params: {
    item: unknown;
    targetResult: unknown;

    scorerResults:
      Record<
        string,
        unknown
      >;
  }) =>
    void |
    Promise<void>;
};

export async function runPilotEvals(
  options: PilotEvalOptions,
) {
  const threadId =
    `pilot-eval-${randomUUID()}`;

  const memory =
    await pilotResearchAgent
      .getMemory();

  if (!memory) {
    throw new Error(
      'Pilot Research Agent memory is not configured.',
    );
  }

  await memory.createThread({
    threadId,

    resourceId:
      EVAL_RESOURCE_ID,

    title:
      `Pilot eval ${threadId}`,
  });

  const targetOptions = {
    memory: {
      thread:
        threadId,

      resource:
        EVAL_RESOURCE_ID,
    },
  };

  const concurrency =
    options.concurrency ??
    pilotConfig.eval
      .concurrency;

  if (
    options.gates &&
    options.gates.length > 0
  ) {
    return runEvals({
      data:
        options.data,

      target:
        pilotResearchAgent,

      targetOptions,

      gates:
        options.gates,

      scorers:
        options.scorers,

      concurrency,

      onItemComplete:
        options.onItemComplete as any,
    });
  }

  if (
    options.scorers &&
    options.scorers.length > 0
  ) {
    return runEvals({
      data:
        options.data,

      target:
        pilotResearchAgent,

      targetOptions,

      scorers:
        options.scorers,

      concurrency,

      onItemComplete:
        options.onItemComplete as any,
    });
  }

  throw new Error(
    'Pilot eval requires at least one scorer or gate.',
  );
}
