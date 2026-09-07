import { LibSQLStore } from '@mastra/libsql';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

export type PilotRuntimeStorageConfig = {
  url: string;
  authToken: string;
};

export function getPilotRuntimeStorageConfig(): PilotRuntimeStorageConfig | undefined {
  const url = process.env.PILOT_MASTRA_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url && !authToken) {
    if (
      process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL_ENV === 'preview'
    ) {
      return undefined;
    }
    const localPath = join(
      dirname(fileURLToPath(new URL(import.meta.url))),
      '..',
      '..',
      '.mastra',
      'pilot-runtime.db',
    );
    return {
      url: pathToFileURL(localPath).href,
      authToken: 'local-dev',
    };
  }

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
