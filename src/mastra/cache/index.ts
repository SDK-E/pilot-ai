import { createGenericCache, type GenericCache } from "./generic-cache.js";

import type { Pool } from "pg";

const shared: { toolCache?: GenericCache } = {};

/**
 * Points the shared tool cache at the runtime database.
 */
export function setRuntimeCache(pool: Pool): void {
  shared.toolCache = createGenericCache({
    pool,
    tableName: "pilot_tool_cache",
  });
}

function requireCache(): GenericCache {
  if (!shared.toolCache) {
    throw new Error("The tool cache is not configured for this runtime.");
  }
  return shared.toolCache;
}

export function makeCacheKey(type: string, input: unknown): string {
  return requireCache().makeCacheKey(type, input);
}

export async function getCachedValue<T>(key: string): Promise<T | undefined> {
  return requireCache().getCachedValue<T>(key);
}

export async function setCachedValue(
  key: string,
  type: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  return requireCache().setCachedValue(key, type, value, ttlMs);
}
