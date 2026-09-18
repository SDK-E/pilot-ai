import { Pool } from "pg";

import { pilotConfig } from "../agents/base/profiles/index.js";
import { createCircuitBreaker } from "../cache/domain-circuit-breaker.js";
import { createGenericCache } from "../cache/generic-cache.js";
import { setRuntimeCache } from "../cache/index.js";
import { setGithubToken } from "../tools/code/github-public.js";
import { setLangSearchApiKey } from "../tools/search/langsearch.js";
import { setUrlFetchConfig } from "../tools/web/url-fetch.js";

import type { PilotRuntimeStorageConfig } from "../storage/runtime.js";

export interface WebToolSecrets {
  langsearchApiKey?: string;
  githubToken?: string;
}

const configured: { connectionString?: string } = {};

/**
 * Wires the public-web tools (search, fetch, discovery, GitHub) to the
 * runtime database cache, the domain circuit breaker, and this request's
 * admin-managed secrets. The cache/circuit-breaker wiring only reconfigures
 * when the storage target changes; the secrets are set on every call since
 * they carry no cost to reapply and may legitimately change between calls.
 */
export function configureWebTools(
  storage: PilotRuntimeStorageConfig,
  secrets: WebToolSecrets = {},
): void {
  setLangSearchApiKey(secrets.langsearchApiKey);
  setGithubToken(secrets.githubToken);

  if (configured.connectionString === storage.connectionString) return;
  const pool = new Pool({ connectionString: storage.connectionString });
  const cache = createGenericCache({ pool, tableName: "pilot_tool_cache" });
  const circuitBreaker = createCircuitBreaker(
    pilotConfig.network.circuitBreaker,
  );

  setRuntimeCache(pool);
  setUrlFetchConfig({
    fetchTimeoutMs: pilotConfig.network.fetchTimeoutMs,
    fetchTtlMs: pilotConfig.cache.fetchTtlMs,
    ...circuitBreaker,
    ...cache,
  });
  configured.connectionString = storage.connectionString;
}
