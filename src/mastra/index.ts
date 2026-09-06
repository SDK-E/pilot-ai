import { Mastra } from '@mastra/core/mastra';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import {
  MastraStorageExporter,
  Observability,
} from '@mastra/observability';

import {
  pilotBrowser,
} from './agents/pilot-browser';

import {
  answerRelevancyScorer,
  completenessScorer,
  sourceCoverageScorer,
  taskCompletionScorer,
} from './scorers';

import {
  seedPilotDatasets,
} from './evals/seed-pilot-dataset';

const defaultStorage =
  new LibSQLStore({
    id: 'mastra-storage',

    url:
      process.env.MASTRA_DATABASE_URL ??
      'file:./mastra.db',
  });

const editorStorage =
  new LibSQLStore({
    id: 'mastra-editor-storage',

    url:
      process.env.MASTRA_EDITOR_DATABASE_URL ??
      'file:./mastra-editor.db',
  });

const observabilityStorage =
  new DuckDBStore({
    id: 'mastra-observability',
  });

const datasetsStorage =
  await defaultStorage.getStore(
    'datasets',
  );

const experimentsStorage =
  await defaultStorage.getStore(
    'experiments',
  );

const scoresStorage =
  await defaultStorage.getStore(
    'scores',
  );

const observabilityDomain =
  await observabilityStorage.getStore(
    'observability',
  );

if (!datasetsStorage) {
  throw new Error(
    'Datasets storage is unavailable.',
  );
}

if (!experimentsStorage) {
  throw new Error(
    'Experiments storage is unavailable.',
  );
}

if (!scoresStorage) {
  throw new Error(
    'Scores storage is unavailable.',
  );
}

if (!observabilityDomain) {
  throw new Error(
    'Observability storage is unavailable.',
  );
}

const storage =
  new MastraCompositeStore({
    id: 'mastra-composite-storage',

    default:
      defaultStorage,

    editor:
      editorStorage,

    domains: {
      datasets:
        datasetsStorage,

      experiments:
        experimentsStorage,

      scores:
        scoresStorage,

      observability:
        observabilityDomain,
    },
  });

export const mastra =
  new Mastra({
    agents: {
      pilotBrowser,
    },

    scorers: {
      answerRelevancyScorer,
      completenessScorer,
      sourceCoverageScorer,
      taskCompletionScorer,
    },

    storage,

    observability:
      new Observability({
        configs: {
          default: {
            serviceName:
              'pilot-ai',

            logging: {
              enabled: true,
              level: 'info',
            },

            exporters: [
              new MastraStorageExporter(),
            ],
          },
        },
      }),

    editor:
      new MastraEditor(),
  });

await seedPilotDatasets(
  mastra,
);