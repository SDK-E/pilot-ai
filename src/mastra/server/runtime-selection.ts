import { createChatRuntime } from "../agents/runtime/chat-runtime.js";
import { createToolRuntime } from "../agents/runtime/tool-runtime.js";

import type { GenerateConversationReply } from "../../contracts/conversation.js";
import type { PilotRuntimeStorageConfig } from "../storage/runtime.js";

export type ConversationRuntime =
  ReturnType<typeof createChatRuntime> | ReturnType<typeof createToolRuntime>;

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
      runtime: createChatRuntime(storageConfig, oidcToken ?? undefined),
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
    runtime: createToolRuntime(storageConfig, oidcToken),
  };
}
