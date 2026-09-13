import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { MastraStorageExporter, Observability } from '@mastra/observability';

function requireValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Pilot Research Agent development.`);
  }

  return value;
}

export async function createResearchDevelopmentStorage() {
  const defaultStorage = new LibSQLStore({
    id: 'pilot-research-storage',
    url: requireValue('MASTRA_DATABASE_URL'),
  });
  const editorStorage = new LibSQLStore({
    id: 'pilot-research-editor-storage',
    url: requireValue('MASTRA_EDITOR_DATABASE_URL'),
  });
  const observabilityStorage = new DuckDBStore({
    id: 'pilot-research-observability',
  });
  const [datasets, experiments, scores, observability] = await Promise.all([
    defaultStorage.getStore('datasets'),
    defaultStorage.getStore('experiments'),
    defaultStorage.getStore('scores'),
    observabilityStorage.getStore('observability'),
  ]);

  if (!datasets || !experiments || !scores || !observability) {
    throw new Error('Pilot Research Agent development storage is unavailable.');
  }

  return new MastraCompositeStore({
    id: 'pilot-research-development-storage',
    default: defaultStorage,
    editor: editorStorage,
    domains: { datasets, experiments, scores, observability },
  });
}

export function createResearchDevelopmentObservability() {
  return {
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'pilot-research-development',
          logging: { enabled: true, level: 'info' },
          exporters: [new MastraStorageExporter()],
        },
      },
    }),
    editor: new MastraEditor(),
  };
}
