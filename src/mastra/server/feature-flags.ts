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

/**
 * Platform-level circuit breakers, one per gated capability, read from
 * Vercel Edge Config so they can be flipped without a redeploy. Independent
 * of any org's own preference — pilot checks those separately. Any read
 * failure (missing EDGE_CONFIG, network error, unset key) fails closed to
 * `DISABLED` rather than throwing, since a broken flag read must not grant
 * a capability.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const [webSearchEnabled, codeSandboxEnabled, connectorsEnabled] =
      await Promise.all([
        get<boolean>("webSearchEnabled"),
        get<boolean>("codeSandboxEnabled"),
        get<boolean>("connectorsEnabled"),
      ]);
    return {
      webSearchEnabled: webSearchEnabled === true,
      codeSandboxEnabled: codeSandboxEnabled === true,
      connectorsEnabled: connectorsEnabled === true,
    };
  } catch (error) {
    logger.error("Feature flag read failed; failing closed.", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return DISABLED;
  }
}
