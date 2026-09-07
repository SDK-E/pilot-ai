import { createClient } from '@libsql/client';

import { createCircuitBreaker } from '../cache/domain-circuit-breaker.js';
import { createGenericCache } from '../cache/generic-cache.js';
import { setRuntimeCache } from '../cache/index.js';
import { pilotConfig } from './config/index.js';
import type { PilotRuntimeStorageConfig } from '../storage/pilot-runtime.js';
import { setUrlFetchConfig } from '../tools/url-fetch.js';
import { setLangSearchConfig } from '../tools/search/langsearch.js';
import { setWebSearchConfig } from '../tools/search/web-search.js';

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
