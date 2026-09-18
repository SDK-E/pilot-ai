import type { Pool } from "pg";

interface GenericCacheConfig {
  pool: Pool;
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
  pool,
  tableName,
}: GenericCacheConfig): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      cache_key TEXT PRIMARY KEY,
      cache_type TEXT NOT NULL,
      value_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
}

async function readValue<T>(
  { pool, tableName }: GenericCacheConfig,
  key: string,
): Promise<T | undefined> {
  const result = await pool.query<{ value_json: string; expires_at: Date }>(
    `SELECT value_json, expires_at FROM ${tableName} WHERE cache_key = $1 LIMIT 1`,
    [key],
  );
  const row = result.rows.at(0);
  if (!row) return undefined;

  if (row.expires_at.getTime() <= Date.now()) {
    await pool.query(`DELETE FROM ${tableName} WHERE cache_key = $1`, [key]);
    return undefined;
  }

  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return undefined;
  }
}

async function writeValue(
  { pool, tableName }: GenericCacheConfig,
  entry: { key: string; type: string; value: unknown; ttlMs: number },
): Promise<void> {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + entry.ttlMs);
  await pool.query(
    `
      INSERT INTO ${tableName} (cache_key, cache_type, value_json, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cache_key) DO UPDATE SET
        cache_type = excluded.cache_type,
        value_json = excluded.value_json,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `,
    [entry.key, entry.type, JSON.stringify(entry.value), createdAt, expiresAt],
  );
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
