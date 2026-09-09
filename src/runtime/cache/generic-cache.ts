import type { createClient } from "@libsql/client";

type Client = ReturnType<typeof createClient>;

type GenericCacheConfig = {
  client: Client;
  tableName: string;
};

type GenericCache = {
  makeCacheKey: (type: string, input: unknown) => string;
  getCachedValue: <T>(key: string) => Promise<T | undefined>;
  setCachedValue: (
    key: string,
    type: string,
    value: unknown,
    ttlMs: number,
  ) => Promise<void>;
};

export function createGenericCache(config: GenericCacheConfig): GenericCache {
  const { client, tableName } = config;

  let initializationPromise: Promise<void> | undefined;

  async function initialize(): Promise<void> {
    initializationPromise ??= client
      .execute(
        `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          cache_key TEXT PRIMARY KEY,
          cache_type TEXT NOT NULL,
          value_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        )
      `,
      )
      .then(() => undefined);

    await initializationPromise;
  }

  function makeCacheKey(type: string, input: unknown): string {
    return `${type}:${JSON.stringify(input)}`;
  }

  async function getCachedValue<T>(key: string): Promise<T | undefined> {
    await initialize();

    const result = await client.execute({
      sql: `
        SELECT value_json, expires_at
        FROM ${tableName}
        WHERE cache_key = ?
        LIMIT 1
      `,
      args: [key],
    });

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    const expiresAt = row.expires_at;

    if (
      typeof expiresAt !== "string" ||
      new Date(expiresAt).getTime() <= Date.now()
    ) {
      await client.execute({
        sql: `
          DELETE FROM ${tableName}
          WHERE cache_key = ?
        `,
        args: [key],
      });

      return undefined;
    }

    const raw = row.value_json;

    if (typeof raw !== "string") {
      return undefined;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async function setCachedValue(
    key: string,
    type: string,
    value: unknown,
    ttlMs: number,
  ): Promise<void> {
    await initialize();

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);

    await client.execute({
      sql: `
        INSERT INTO ${tableName} (
          cache_key,
          cache_type,
          value_json,
          created_at,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?)

        ON CONFLICT(cache_key)
        DO UPDATE SET
          cache_type = excluded.cache_type,
          value_json = excluded.value_json,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at
      `,
      args: [
        key,
        type,
        JSON.stringify(value),
        createdAt.toISOString(),
        expiresAt.toISOString(),
      ],
    });
  }

  return {
    makeCacheKey,
    getCachedValue,
    setCachedValue,
  };
}
