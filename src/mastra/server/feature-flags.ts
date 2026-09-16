import { get } from "@vercel/edge-config";

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

// The account's Vercel plan caps Edge Config at one store total, so the
// three environments share it: each flag's value is an object keyed by
// environment rather than a single boolean. VERCEL_ENV is set by Vercel
// itself at runtime (unset locally outside `vercel dev`, hence the fallback).
type PerEnvironmentFlag = Partial<Record<FlagEnvironment, boolean>>;

function currentEnvironment(): FlagEnvironment {
  const value = process.env.VERCEL_ENV;
  return value === "production" || value === "preview" ? value : "development";
}

/**
 * Platform-level circuit breakers, one per gated capability, read from
 * Vercel Edge Config so they can be flipped per environment without a
 * redeploy. Independent of any org's own preference — pilot checks those
 * separately. Any read failure (missing EDGE_CONFIG, network error, unset
 * key) fails closed to `DISABLED` rather than throwing, since a broken flag
 * read must not grant a capability.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const environment = currentEnvironment();
  try {
    const [webSearchEnabled, codeSandboxEnabled, connectorsEnabled] =
      await Promise.all([
        get<PerEnvironmentFlag>("webSearchEnabled"),
        get<PerEnvironmentFlag>("codeSandboxEnabled"),
        get<PerEnvironmentFlag>("connectorsEnabled"),
      ]);
    return {
      webSearchEnabled: webSearchEnabled?.[environment] === true,
      codeSandboxEnabled: codeSandboxEnabled?.[environment] === true,
      connectorsEnabled: connectorsEnabled?.[environment] === true,
    };
  } catch (error) {
    logger.error("Feature flag read failed; failing closed.", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return DISABLED;
  }
}
