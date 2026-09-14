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

/**
 * Opens the runtime for a command. Granted capabilities need the caller's
 * OIDC token for activity callbacks; public web search is additionally gated
 * by the production feature flag.
 */
export function selectConversationRuntime(
  command: GenerateConversationReply,
  oidcToken: string | null,
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
  if (hasCapabilities && !oidcToken) {
    return {
      ok: false,
      status: 401,
      type: "authentication_error",
      message: "Unauthorized.",
    };
  }
  return {
    ok: true,
    runtime: createPilotRuntime(storageConfig, oidcToken ?? undefined),
  };
}
