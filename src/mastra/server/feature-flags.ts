import Redis from "ioredis";

import { logger } from "../logger.js";

export interface FeatureFlags {
  webSearchEnabled: boolean;
  codeSandboxEnabled: boolean;
  connectorsEnabled: boolean;
}

const DISABLED: FeatureFlags = {
  webSearchEnabled: false,
  codeSandboxEnabled: false,
  connectorsEnabled: false,
};

type FlagEnvironment = "development" | "preview" | "production";

// One Key Value store is shared across environments (Render free tier, one
// instance per workspace), so each flag's value is an object keyed by
// environment rather than a single boolean. PILOT_DEPLOY_ENVIRONMENT is set
// per Render service; unset locally, hence the "development" fallback.
type PerEnvironmentFlag = Partial<Record<FlagEnvironment, boolean>>;

function currentEnvironment(): FlagEnvironment {
  const value = process.env.PILOT_DEPLOY_ENVIRONMENT;
  return value === "production" || value === "preview" ? value : "development";
}

const state: { client?: Redis } = {};

function getClient(): Redis | undefined {
  const url = process.env.PILOT_FEATURE_FLAGS_REDIS_URL?.trim();
  if (!url) return undefined;
  state.client ??= new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  return state.client;
}

/**
 * Platform-level circuit breakers, one per gated capability, read from a
 * Key Value store independent of Pilot's own database so they can be
 * flipped per environment without a redeploy and without a compromised
 * Pilot admin account also being able to flip them. Any read failure
 * (missing URL, connection error, unset key) fails closed to `DISABLED`
 * rather than throwing, since a broken flag read must not grant a
 * capability.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const environment = currentEnvironment();
  const redis = getClient();
  if (!redis) return DISABLED;
  try {
    const [webSearchEnabled, codeSandboxEnabled, connectorsEnabled] =
      await Promise.all([
        redis.get("flag:webSearchEnabled"),
        redis.get("flag:codeSandboxEnabled"),
        redis.get("flag:connectorsEnabled"),
      ]);
    const parse = (raw: string | null): PerEnvironmentFlag =>
      raw ? (JSON.parse(raw) as PerEnvironmentFlag) : {};
    return {
      webSearchEnabled: parse(webSearchEnabled)[environment] === true,
      codeSandboxEnabled: parse(codeSandboxEnabled)[environment] === true,
      connectorsEnabled: parse(connectorsEnabled)[environment] === true,
    };
  } catch (error) {
    logger.error("Feature flag read failed; failing closed.", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return DISABLED;
  }
}
