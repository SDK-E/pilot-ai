import {
  createCircuitBreaker,
} from '#runtime/cache/domain-circuit-breaker';
import {
  createClient,
  type Client,
} from '@libsql/client';
import {
  createGenericCache,
} from '#runtime/cache/generic-cache';
import { createSkillFeedback } from '#runtime/cache/skill-feedback';
import type { UrlFetchConfig } from '#runtime/tools/url-fetch';

import {
  researchMemoryDatabaseAuthToken,
  researchMemoryDatabaseUrl,
} from '#runtime/research/config/research-agent/storage';
import { pilotConfig } from '#runtime/research/config';

const client: Client = createClient({
  url: researchMemoryDatabaseUrl,
  authToken: researchMemoryDatabaseAuthToken,
});

const researchCache = createGenericCache({
  client,
  tableName: 'pilot_research_cache',
});

const domainCircuitBreaker = createCircuitBreaker({
  failureThreshold:
    pilotConfig.network.circuitBreaker.failureThreshold,
  blockDurationMs:
    pilotConfig.network.circuitBreaker.blockDurationMs,
});

const skillFeedback = createSkillFeedback({
  client,
  tableName: 'pilot_skill_feedback',
});

export function createUrlFetchConfig(): UrlFetchConfig {
  return {
    fetchTimeoutMs:
      pilotConfig.network.fetchTimeoutMs,
    fetchTtlMs:
      pilotConfig.cache.fetchTtlMs,
    canRequestDomain:
      domainCircuitBreaker.canRequestDomain.bind(
        domainCircuitBreaker,
      ),
    recordDomainFailure:
      domainCircuitBreaker.recordDomainFailure.bind(
        domainCircuitBreaker,
      ),
    recordDomainSuccess:
      domainCircuitBreaker.recordDomainSuccess.bind(
        domainCircuitBreaker,
      ),
    getCachedValue:
      researchCache.getCachedValue.bind(
        researchCache,
      ),
    setCachedValue:
      researchCache.setCachedValue.bind(
        researchCache,
      ),
    makeCacheKey:
      researchCache.makeCacheKey.bind(
        researchCache,
      ),
  };
}