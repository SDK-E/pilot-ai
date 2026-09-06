import { mastra } from '../index';

import {
  seedPilotDataset,
} from './seed-pilot-dataset';

export async function runPilotExperiment() {
  const dataset =
    await seedPilotDataset();

  return dataset.startExperiment({
    targetType: 'agent',

    targetId:
      'pilot-browser',

    name:
      `pilot-browser-${new Date().toISOString()}`,

    description:
      'Pilot Browser regression experiment.',

    scorers: [
      'answer-relevancy-scorer',
      'completeness-scorer',
      'pilot-source-coverage',
      'pilot-task-completion',
    ],

    maxConcurrency: 2,

    itemTimeout:
      10 * 60 * 1000,

    maxRetries: 1,
  });
}