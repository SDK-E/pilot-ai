import { createClient } from "@libsql/client";

import { pilotConfig } from "../agents/base/profiles/index.js";
import { createCircuitBreaker } from "../cache/domain-circuit-breaker.js";
import { createGenericCache } from "../cache/generic-cache.js";
import { setRuntimeCache } from "../cache/index.js";
import { setUrlFetchConfig } from "../tools/web/url-fetch.js";

import type { PilotRuntimeStorageConfig } from "../storage/runtime.js";

const configured: { storageUrl?: string } = {};

/**
 * Wires the public-web tools (search, fetch, discovery) to the runtime
 * database cache and the domain circuit breaker. Safe to call per request;
 * it only reconfigures when the storage target changes.
 */
export function configureWebTools(storage: PilotRuntimeStorageConfig): void {
  if (configured.storageUrl === storage.url) return;
  const client = createClient({
    url: storage.url,
    authToken: storage.authToken,
  });
  const cache = createGenericCache({ client, tableName: "pilot_tool_cache" });
  const circuitBreaker = createCircuitBreaker(
    pilotConfig.network.circuitBreaker,
  );

  setRuntimeCache(client);
  setUrlFetchConfig({
    fetchTimeoutMs: pilotConfig.network.fetchTimeoutMs,
    fetchTtlMs: pilotConfig.cache.fetchTtlMs,
    ...circuitBreaker,
    ...cache,
  });
  configured.storageUrl = storage.url;
}
