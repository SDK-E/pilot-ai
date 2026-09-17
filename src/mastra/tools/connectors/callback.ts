import { pilotCallbackUrl } from "../../activity/callback-url.js";

import type { GenerateConversationReply } from "../../../contracts/conversation.js";

export interface ConnectorToolContext {
  command: GenerateConversationReply;
  runtimeToken: string;
}

export interface ConnectorCallRequest {
  context: ConnectorToolContext;
  toolId: string;
  toolLabel: string;
  action: string;
  params: Record<string, unknown>;
  /**
  Target a specific connection instead of the provider's default one.
  */
  connectionId?: string;
  /**
   * Which connector to call — the `connector` tool only.
   */
  connectorSlug?: string;
  /**
   * Required to actually run a mutating action; omitting it (or `false`)
   * returns a `confirmationRequired` result instead of a side effect.
   */
  confirm?: boolean;
}

async function safeErrorBody(
  response: Response,
): Promise<{ error?: string; kind?: string }> {
  try {
    return (await response.json()) as { error?: string; kind?: string };
  } catch {
    return {};
  }
}

/**
 * A failed connector call, carrying Pilot's structured failure `kind`
 * (invalid-input / auth-required / not-found / rate-limited / etc. — see
 * `connector-error.ts` in the Pilot app) instead of only a message, so a
 * tool's `execute` (or a future retry policy) can react to why it failed,
 * not just that it failed.
 */
export class ConnectorCallError extends Error {
  readonly kind: string;

  constructor(kind: string, message: string) {
    super(message);
    this.name = "ConnectorCallError";
    this.kind = kind;
  }
}

/**
 * The callback URL every connector tool posts to, computed once by each tool
 * factory (not at module load, so importing this file never throws just
 * because PILOT_ACTIVITY_CALLBACK_URL is unset — e.g. in unit tests — and
 * not inside callConnector, so it isn't re-parsed on every execute() call).
 */
export function connectorsExecuteUrl(): URL {
  return new URL("/api/runtime/connectors/execute", pilotCallbackUrl().origin);
}

/**
 * Posts one connector action to Pilot's `/api/runtime/connectors/execute`
 * callback and returns its `result` field, parsed by the caller's own
 * outputSchema. Every connector tool shares this shape: same callback URL,
 * same auth header, same envelope — only `toolId`, `action`, and `params`
 * differ per tool.
 */
export async function callConnector(
  request: ConnectorCallRequest & { callbackUrl: URL },
): Promise<unknown> {
  const {
    context,
    toolId,
    toolLabel,
    action,
    params,
    callbackUrl,
    connectionId,
    connectorSlug,
    confirm,
  } = request;
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pilot-runtime-token": context.runtimeToken,
    },
    body: JSON.stringify({
      organizationId: context.command.organizationId,
      executionId: context.command.executionId,
      toolId,
      action,
      params,
      ...(connectionId && { connectionId }),
      ...(connectorSlug && { connectorSlug }),
      ...(confirm !== undefined && { confirm }),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await safeErrorBody(response);
    throw new ConnectorCallError(
      body.kind ?? "unknown",
      body.error ??
        `${toolLabel} connector callback returned ${response.status}.`,
    );
  }
  const body = (await response.json()) as { result: unknown };
  return body.result;
}
