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
}

async function safeErrorBody(response: Response): Promise<{ error?: string }> {
  try {
    return (await response.json()) as { error?: string };
  } catch {
    return {};
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
  const { context, toolId, toolLabel, action, params, callbackUrl } = request;
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
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await safeErrorBody(response);
    throw new Error(
      body.error ??
        `${toolLabel} connector callback returned ${response.status}.`,
    );
  }
  const body = (await response.json()) as { result: unknown };
  return body.result;
}
