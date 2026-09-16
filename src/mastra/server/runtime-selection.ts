import { ALLOWED_TOOL_IDS } from "../../contracts/conversation.js";
import {
  createPilotRuntime,
  type PilotRuntime,
} from "../agents/runtime/runtime.js";

import { getFeatureFlags } from "./feature-flags.js";

import type { GenerateConversationReply } from "../../contracts/conversation.js";
import type { PilotRuntimeStorageConfig } from "../storage/runtime.js";

export type ConversationRuntime = PilotRuntime;

export type RuntimeSelection =
  | { ok: true; runtime: ConversationRuntime }
  | {
      ok: false;
      status: 401 | 403;
      type: "authentication_error" | "invalid_request_error";
      message: string;
    };

/**
 * Every connector tool id, derived from ALLOWED_TOOL_IDS rather than listed
 * again here, so a new connector only needs adding in one place to also be
 * gated by the single PILOT_ENABLE_CONNECTORS platform circuit breaker,
 * regardless of which external provider it calls.
 */
export const CONNECTOR_TOOL_IDS = new Set<string>(
  ALLOWED_TOOL_IDS.filter((id) => id.startsWith("connector-")),
);

/**
 * Opens the runtime for a command. Granted capabilities need the caller's
 * runtime token for activity callbacks; public web search, the code sandbox,
 * and connectors are additionally gated by their own production feature
 * flags (Edge Config, see feature-flags.ts) — pilot checks these too, but a
 * request must not depend on that alone.
 */
export async function selectConversationRuntime(
  command: GenerateConversationReply,
  runtimeToken: string | null,
  storageConfig: PilotRuntimeStorageConfig,
): Promise<RuntimeSelection> {
  const hasCapabilities = command.allowedToolIds.length > 0;
  const flags = await getFeatureFlags();
  if (
    command.allowedToolIds.includes("web-search") &&
    !flags.webSearchEnabled
  ) {
    return {
      ok: false,
      status: 403,
      type: "invalid_request_error",
      message: "Pilot public web search is not enabled.",
    };
  }
  if (
    command.allowedToolIds.includes("code-sandbox") &&
    !flags.codeSandboxEnabled
  ) {
    return {
      ok: false,
      status: 403,
      type: "invalid_request_error",
      message: "Pilot code sandbox is not enabled.",
    };
  }
  if (
    command.allowedToolIds.some((id) => CONNECTOR_TOOL_IDS.has(id)) &&
    !flags.connectorsEnabled
  ) {
    return {
      ok: false,
      status: 403,
      type: "invalid_request_error",
      message: "Pilot connectors are not enabled.",
    };
  }
  if (hasCapabilities && !runtimeToken) {
    return {
      ok: false,
      status: 401,
      type: "authentication_error",
      message: "Unauthorized.",
    };
  }
  return {
    ok: true,
    runtime: createPilotRuntime(storageConfig, runtimeToken ?? undefined),
  };
}
