import { MastraCompositeStore } from "@mastra/core/storage";
import { DuckDBStore } from "@mastra/duckdb";
import { MastraEditor } from "@mastra/editor";
import { LibSQLStore } from "@mastra/libsql";
import { MastraStorageExporter, Observability } from "@mastra/observability";

export { memoryStorage, memoryVector } from "./development-memory.js";

function requireValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is required when PILOT_ENABLE_DEVELOPMENT_TOOLS=true.`,
    );
  }

  return value;
}

export async function createDevelopmentStorage() {
  const defaultStorage = new LibSQLStore({
    id: "pilot-development-storage",
    url: requireValue("MASTRA_DATABASE_URL"),
  });
  const editorStorage = new LibSQLStore({
    id: "pilot-development-editor-storage",
    url: requireValue("MASTRA_EDITOR_DATABASE_URL"),
  });
  const observabilityStorage = new DuckDBStore({
    id: "pilot-development-observability",
  });
  const [datasets, experiments, scores, observability] = await Promise.all([
    defaultStorage.getStore("datasets"),
    defaultStorage.getStore("experiments"),
    defaultStorage.getStore("scores"),
    observabilityStorage.getStore("observability"),
  ]);

  if (!datasets || !experiments || !scores || !observability) {
    throw new Error("Development storage is unavailable.");
  }

  return new MastraCompositeStore({
    id: "pilot-development-composite-storage",
    default: defaultStorage,
    editor: editorStorage,
    domains: { datasets, experiments, scores, observability },
  });
}

export function createDevelopmentObservability() {
  return {
    observability: new Observability({
      configs: {
        default: {
          serviceName: "pilot-development",
          logging: { enabled: true, level: "info" },
          exporters: [new MastraStorageExporter()],
        },
      },
    }),
    editor: new MastraEditor(),
  };
}
