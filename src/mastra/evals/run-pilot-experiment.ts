import { mastra } from '../index';

import { pilotConfig } from '../config';

import {
  seedPilotDataset,
} from './seed-pilot-dataset';

export async function runPilotExperiment() {
  const dataset =
    await seedPilotDataset();

  return dataset.startExperiment({
    targetType:
      'agent',

    targetId:
      'pilot-browser',

    name:
      `pilot-browser-${pilotConfig.profile}-${new Date().toISOString()}`,

    description:
      `Pilot Browser ${pilotConfig.profile} regression experiment.`,

    scorers: [
      'answer-relevancy-scorer',
      'completeness-scorer',
      'pilot-source-coverage',
      'pilot-task-completion',
    ],

    maxConcurrency:
      pilotConfig.eval
        .concurrency,

    itemTimeout:
      pilotConfig.eval
        .timeoutMs,

    maxRetries:
      pilotConfig.eval
        .maxRetries,
  });
}