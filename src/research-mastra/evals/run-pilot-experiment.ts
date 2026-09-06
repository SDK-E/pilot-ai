import {
  mastra,
} from '../index';

import {
  pilotConfig,
} from '../config';

import {
  resolvePilotEvalMode,
  type PilotEvalMode,
} from './pilot-dataset';

import {
  seedPilotDataset,
} from './seed-pilot-dataset';

const SMOKE_TIMEOUT_MS =
  50_000;

const REGRESSION_TIMEOUT_MS =
  120_000;

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

function resolveTargetId(
  mode: PilotEvalMode,
): string {
  if (
    mode === 'smoke'
  ) {
    return 'pilot-research-smoke';
  }

  return 'pilot-research';
}

export async function runPilotExperiment() {
  const mode =
    resolvePilotEvalMode();

  const dataset =
    await seedPilotDataset(
      mastra,
      mode,
    );

  const targetId =
    resolveTargetId(
      mode,
    );

  return dataset.startExperiment({
    targetType:
      'agent',

    targetId,

    name:
      `${targetId}-${mode}-${new Date().toISOString()}`,

    description:
      mode === 'smoke'
        ? 'Fast persisted Pilot Research Agent smoke experiment.'
        : `Pilot Research Agent ${mode} experiment.`,

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
      mode === 'smoke'
        ? 1
        : pilotConfig.eval
            .concurrency,

    itemTimeout:
      resolveTimeout(
        mode,
      ),

    maxRetries:
      mode === 'smoke'
        ? 0
        : pilotConfig.eval
            .maxRetries,
  });
}
