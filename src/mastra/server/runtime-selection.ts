import {
  createPilotRuntime,
  type PilotRuntime,
} from "../agents/runtime/runtime.js";

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

export function isPublicWebSearchEnabled(): boolean {
  return process.env.PILOT_ENABLE_WEB_SEARCH === "true";
}

export function isCodeSandboxEnabled(): boolean {
  return process.env.PILOT_ENABLE_CODE_SANDBOX === "true";
}

export function isConnectorsEnabled(): boolean {
  return process.env.PILOT_ENABLE_CONNECTORS === "true";
}

/**
 * The eight connector tool ids, all gated by the single PILOT_ENABLE_CONNECTORS
 * platform circuit breaker regardless of which external provider they call.
 */
export const CONNECTOR_TOOL_IDS = new Set<string>([
  "connector-github",
  "connector-google-drive",
  "connector-gmail",
  "connector-slack",
  "connector-notion",
  "connector-linear",
  "connector-vercel",
  "connector-monday",
]);

/**
 * Opens the runtime for a command. Granted capabilities need the caller's
 * runtime token for activity callbacks; public web search and the code sandbox
 * are additionally gated by their own production feature flags — pilot
 * checks these too, but a request must not depend on that alone.
 */
export function selectConversationRuntime(
  command: GenerateConversationReply,
  runtimeToken: string | null,
  storageConfig: PilotRuntimeStorageConfig,
): RuntimeSelection {
  const hasCapabilities = command.allowedToolIds.length > 0;
  if (
    command.allowedToolIds.includes("web-search") &&
    !isPublicWebSearchEnabled()
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
    !isCodeSandboxEnabled()
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
    !isConnectorsEnabled()
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
