import { createClient } from '@libsql/client';

import { createCircuitBreaker } from '#runtime/cache/domain-circuit-breaker';
import { createGenericCache } from '#runtime/cache/generic-cache';
import { setRuntimeCache } from '#runtime/cache';
import { pilotConfig } from '#runtime/research/config';
import type { PilotRuntimeStorageConfig } from '#runtime/storage/pilot-runtime';
import { setUrlFetchConfig } from '#runtime/tools/url-fetch';
import { setLangSearchConfig } from '#runtime/tools/search/langsearch';
import { setWebSearchConfig } from '#runtime/tools/search/web-search';

/**
 * Configures only the production-safe read-only web tool. The development
 * registration owns Stagehand, file, export, and browser configurations.
 */
export function configureProductionResearchTools(
  storage: PilotRuntimeStorageConfig,
): void {
  const client = createClient({ url: storage.url, authToken: storage.authToken });
  const cache = createGenericCache({
    client,
    tableName: 'pilot_research_cache',
  });
  const circuitBreaker = createCircuitBreaker({
    failureThreshold: pilotConfig.network.circuitBreaker.failureThreshold,
    blockDurationMs: pilotConfig.network.circuitBreaker.blockDurationMs,
  });

  setRuntimeCache(client);
  setLangSearchConfig({});
  setWebSearchConfig({ performStagehandSearch: false });
  setUrlFetchConfig({
    fetchTimeoutMs: pilotConfig.network.fetchTimeoutMs,
    fetchTtlMs: pilotConfig.cache.fetchTtlMs,
    canRequestDomain: circuitBreaker.canRequestDomain,
    recordDomainFailure: circuitBreaker.recordDomainFailure,
    recordDomainSuccess: circuitBreaker.recordDomainSuccess,
    getCachedValue: cache.getCachedValue,
    setCachedValue: cache.setCachedValue,
    makeCacheKey: cache.makeCacheKey,
  });
}
