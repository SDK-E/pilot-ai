import { LibSQLStore } from '@mastra/libsql';

export type PilotRuntimeStorageConfig = {
  url: string;
  authToken: string;
};

export function getPilotRuntimeStorageConfig(): PilotRuntimeStorageConfig | undefined {
  const url = process.env.PILOT_MASTRA_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url && !authToken) return undefined;

  if (!url || !authToken) {
    throw new Error(
      'PILOT_MASTRA_DATABASE_URL and TURSO_AUTH_TOKEN must both be configured.',
    );
  }

  return { url, authToken };
}

export function createPilotRuntimeStorage(config: PilotRuntimeStorageConfig) {
  return new LibSQLStore({
    id: 'pilot-runtime-storage',
    url: config.url,
    authToken: config.authToken,
  });
}
