import { z } from "zod";

import {
  pilotConfigSchema,
  pilotProfileSchema,
  type PilotConfig,
  type PilotProfile,
} from "./schema.js";

const MINUTE_MS = 60 * 1000;

const profiles: Record<PilotProfile, Omit<PilotConfig, "profile">> = {
  fast: {
    cache: { searchTtlMs: 10 * MINUTE_MS, fetchTtlMs: 10 * MINUTE_MS },
    network: {
      fetchTimeoutMs: 15_000,
      circuitBreaker: { failureThreshold: 3, blockDurationMs: 60_000 },
    },
    pipeline: {
      sourceConfidenceEvery: 3,
      taskDependencyEvery: 5,
      entityResolutionEvery: 5,
      recencyCheckEvery: 6,
      contradictionCheckEvery: 6,
      sourceDiversityEvery: 8,
      challengeClaimEvery: 12,
      memoryHygieneEvery: 8,
    },
  },
  balanced: {
    cache: { searchTtlMs: 5 * MINUTE_MS, fetchTtlMs: 5 * MINUTE_MS },
    network: {
      fetchTimeoutMs: 20_000,
      circuitBreaker: { failureThreshold: 3, blockDurationMs: 60_000 },
    },
    pipeline: {
      sourceConfidenceEvery: 2,
      taskDependencyEvery: 4,
      entityResolutionEvery: 4,
      recencyCheckEvery: 5,
      contradictionCheckEvery: 5,
      sourceDiversityEvery: 6,
      challengeClaimEvery: 8,
      memoryHygieneEvery: 6,
    },
  },
  deep: {
    cache: { searchTtlMs: 5 * MINUTE_MS, fetchTtlMs: 5 * MINUTE_MS },
    network: {
      fetchTimeoutMs: 20_000,
      circuitBreaker: { failureThreshold: 3, blockDurationMs: 60_000 },
    },
    pipeline: {
      sourceConfidenceEvery: 1,
      taskDependencyEvery: 4,
      entityResolutionEvery: 4,
      recencyCheckEvery: 5,
      contradictionCheckEvery: 5,
      sourceDiversityEvery: 6,
      challengeClaimEvery: 8,
      memoryHygieneEvery: 6,
    },
  },
  test: {
    cache: { searchTtlMs: 30 * MINUTE_MS, fetchTtlMs: 30 * MINUTE_MS },
    network: {
      fetchTimeoutMs: 10_000,
      circuitBreaker: { failureThreshold: 3, blockDurationMs: 60_000 },
    },
    pipeline: {
      sourceConfidenceEvery: 4,
      taskDependencyEvery: 6,
      entityResolutionEvery: 6,
      recencyCheckEvery: 8,
      contradictionCheckEvery: 8,
      sourceDiversityEvery: 10,
      challengeClaimEvery: 14,
      memoryHygieneEvery: 10,
    },
  },
};

const optionalNumber = z.coerce.number().optional();

/**
 * Environment overrides on top of the selected profile.
 */
const envSchema = z.object({
  PILOT_PROFILE: pilotProfileSchema.default("balanced"),
  PILOT_SEARCH_CACHE_TTL_MS: optionalNumber,
  PILOT_FETCH_CACHE_TTL_MS: optionalNumber,
  PILOT_FETCH_TIMEOUT_MS: optionalNumber,
  PILOT_CIRCUIT_BREAKER_FAILURES: optionalNumber,
  PILOT_CIRCUIT_BREAKER_BLOCK_MS: optionalNumber,
});

function resolveConfig(env: NodeJS.ProcessEnv): PilotConfig {
  const overrides = envSchema.parse(env);
  const base = profiles[overrides.PILOT_PROFILE];
  return pilotConfigSchema.parse({
    profile: overrides.PILOT_PROFILE,
    cache: {
      searchTtlMs:
        overrides.PILOT_SEARCH_CACHE_TTL_MS ?? base.cache.searchTtlMs,
      fetchTtlMs: overrides.PILOT_FETCH_CACHE_TTL_MS ?? base.cache.fetchTtlMs,
    },
    network: {
      fetchTimeoutMs:
        overrides.PILOT_FETCH_TIMEOUT_MS ?? base.network.fetchTimeoutMs,
      circuitBreaker: {
        failureThreshold:
          overrides.PILOT_CIRCUIT_BREAKER_FAILURES ??
          base.network.circuitBreaker.failureThreshold,
        blockDurationMs:
          overrides.PILOT_CIRCUIT_BREAKER_BLOCK_MS ??
          base.network.circuitBreaker.blockDurationMs,
      },
    },
    pipeline: base.pipeline,
  });
}

export const pilotConfig = resolveConfig(process.env);
