import { createClient, type Client } from "@libsql/client";

import { pilotConfig } from "../agents/base/config/index.js";
import { createCircuitBreaker } from "../cache/domain-circuit-breaker.js";
import { createGenericCache } from "../cache/generic-cache.js";
import { createSkillFeedback } from "../cache/skill-feedback.js";
import {
  developmentDatabaseAuthToken,
  developmentDatabaseUrl,
} from "../storage/development-database.js";

import type { UrlFetchConfig } from "../tools/web/url-fetch.js";

const client: Client = createClient({
  url: developmentDatabaseUrl,
  authToken: developmentDatabaseAuthToken,
});

const toolCache = createGenericCache({
  client,
  tableName: "pilot_tool_cache",
});

const domainCircuitBreaker = createCircuitBreaker({
  failureThreshold: pilotConfig.network.circuitBreaker.failureThreshold,
  blockDurationMs: pilotConfig.network.circuitBreaker.blockDurationMs,
});

const skillFeedback = createSkillFeedback({
  client,
  tableName: "pilot_skill_feedback",
});

export function createUrlFetchConfig(): UrlFetchConfig {
  return {
    fetchTimeoutMs: pilotConfig.network.fetchTimeoutMs,
    fetchTtlMs: pilotConfig.cache.fetchTtlMs,
    canRequestDomain:
      domainCircuitBreaker.canRequestDomain.bind(domainCircuitBreaker),
    recordDomainFailure:
      domainCircuitBreaker.recordDomainFailure.bind(domainCircuitBreaker),
    recordDomainSuccess:
      domainCircuitBreaker.recordDomainSuccess.bind(domainCircuitBreaker),
    getCachedValue: toolCache.getCachedValue.bind(toolCache),
    setCachedValue: toolCache.setCachedValue.bind(toolCache),
    makeCacheKey: toolCache.makeCacheKey.bind(toolCache),
  };
}
