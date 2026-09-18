import { PostgresStore } from "@mastra/pg";

export interface PilotRuntimeStorageConfig {
  connectionString: string;
}

export function getPilotRuntimeStorageConfig():
  PilotRuntimeStorageConfig | undefined {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (connectionString) return { connectionString };

  // A real deployment (RENDER is set automatically on every Render service;
  // VERCEL_ENV covers a Vercel one) must not silently run without storage,
  // which would hide a missing DATABASE_URL rather than surfacing it.
  if (
    process.env.RENDER === "true" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  ) {
    return undefined;
  }

  throw new Error(
    "DATABASE_URL is required. Run `neon link` in this directory, or set it directly.",
  );
}

export function createPilotRuntimeStorage(config: PilotRuntimeStorageConfig) {
  return new PostgresStore({
    id: "pilot-runtime-storage",
    connectionString: config.connectionString,
  });
}
