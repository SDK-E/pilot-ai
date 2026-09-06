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
  answerRelevancyScorer,
  completenessScorer,
  sourceCoverageScorer,
  taskCompletionScorer,
} from './scorers';

import {
  pilotBrowser,
} from './agents/pilot-browser';

const defaultStorage =
  new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  });

const editorStorage =
  new LibSQLStore({
    id: 'mastra-editor-storage',
    url: 'file:./mastra-editor.db',
  });

const observabilityStorage =
  new DuckDBStore({
    id: 'mastra-observability',
  });

export const mastra = new Mastra({
  agents: {
    pilotBrowser,
  },

  scorers: {
    answerRelevancyScorer,
    completenessScorer,
    sourceCoverageScorer,
    taskCompletionScorer,
  },

  storage:
    new MastraCompositeStore({
      id: 'mastra-composite-storage',

      default:
        defaultStorage,

      editor:
        editorStorage,

      domains: {
        observability:
          await observabilityStorage.getStore(
            'observability',
          ),
      },
    }),

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