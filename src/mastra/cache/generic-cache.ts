import type { createClient } from "@libsql/client";

type Client = ReturnType<typeof createClient>;

interface GenericCacheConfig {
  client: Client;
  tableName: string;
}

export interface GenericCache {
  makeCacheKey: (type: string, input: unknown) => string;
  getCachedValue: <T>(key: string) => Promise<T | undefined>;
  setCachedValue: (
    key: string,
    type: string,
    value: unknown,
    ttlMs: number,
  ) => Promise<void>;
}

function makeCacheKey(type: string, input: unknown): string {
  return `${type}:${JSON.stringify(input)}`;
}

async function createTable({
  client,
  tableName,
}: GenericCacheConfig): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      cache_key TEXT PRIMARY KEY,
      cache_type TEXT NOT NULL,
      value_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);
}

async function readValue<T>(
  { client, tableName }: GenericCacheConfig,
  key: string,
): Promise<T | undefined> {
  const result = await client.execute({
    sql: `SELECT value_json, expires_at FROM ${tableName} WHERE cache_key = ? LIMIT 1`,
    args: [key],
  });
  const row = result.rows.at(0);
  if (!row) return undefined;

  const expiresAt = row.expires_at;
  const isExpired =
    typeof expiresAt !== "string" ||
    new Date(expiresAt).getTime() <= Date.now();
  if (isExpired) {
    await client.execute({
      sql: `DELETE FROM ${tableName} WHERE cache_key = ?`,
      args: [key],
    });
    return undefined;
  }

  const raw = row.value_json;
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function writeValue(
  { client, tableName }: GenericCacheConfig,
  entry: { key: string; type: string; value: unknown; ttlMs: number },
): Promise<void> {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + entry.ttlMs);
  await client.execute({
    sql: `
      INSERT INTO ${tableName} (cache_key, cache_type, value_json, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        cache_type = excluded.cache_type,
        value_json = excluded.value_json,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `,
    args: [
      entry.key,
      entry.type,
      JSON.stringify(entry.value),
      createdAt.toISOString(),
      expiresAt.toISOString(),
    ],
  });
}

/**
 * A small TTL cache table in the runtime database, created on first use.
 */
export function createGenericCache(config: GenericCacheConfig): GenericCache {
  const ready = { table: undefined as Promise<void> | undefined };
  const ensureTable = () => (ready.table ??= createTable(config));

  return {
    makeCacheKey,
    async getCachedValue(key) {
      await ensureTable();
      return readValue(config, key);
    },
    async setCachedValue(key, type, value, ttlMs) {
      await ensureTable();
      await writeValue(config, { key, type, value, ttlMs });
    },
  };
}
