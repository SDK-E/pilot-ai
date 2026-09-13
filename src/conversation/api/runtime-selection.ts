import { createPilotProductionToolRuntime } from "../../research/pilot-research.js";
import { createPilotConversationRuntime } from "../pilot-conversation.js";

import type { PilotRuntimeStorageConfig } from "../../runtime/storage/pilot-runtime.js";
import type { GenerateConversationReply } from "../command.js";

export type ConversationRuntime =
  | ReturnType<typeof createPilotConversationRuntime>
  | ReturnType<typeof createPilotProductionToolRuntime>;

export type RuntimeSelection =
  | { ok: true; runtime: ConversationRuntime }
  | {
      ok: false;
      status: 401 | 403;
      type: "authentication_error" | "invalid_request_error";
      message: string;
    };

export function isPublicWebSearchEnabled(): boolean {
  return process.env.PILOT_ENABLE_RESEARCH === "true";
}

/**
 * A command with granted capabilities runs on the tool runtime, which needs
 * the caller's OIDC token for its activity callbacks. Public web search is
 * additionally gated by the production feature flag.
 */
export function selectConversationRuntime(
  command: GenerateConversationReply,
  oidcToken: string | null,
  storageConfig: PilotRuntimeStorageConfig,
): RuntimeSelection {
  if (command.allowedToolIds.length === 0) {
    return {
      ok: true,
      runtime: createPilotConversationRuntime(
        storageConfig,
        oidcToken ?? undefined,
      ),
    };
  }
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
  if (!oidcToken) {
    return {
      ok: false,
      status: 401,
      type: "authentication_error",
      message: "Unauthorized.",
    };
  }
  return {
    ok: true,
    runtime: createPilotProductionToolRuntime(storageConfig, oidcToken),
  };
}
