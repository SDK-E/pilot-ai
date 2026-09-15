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
 * Posts one connector action to Pilot's `/api/runtime/connectors/execute`
 * callback and returns its `result` field, parsed by the caller's own
 * outputSchema. Every connector tool shares this shape: same callback URL,
 * same auth header, same envelope — only `toolId`, `action`, and `params`
 * differ per tool.
 */
export async function callConnector(
  request: ConnectorCallRequest,
): Promise<unknown> {
  const { context, toolId, toolLabel, action, params } = request;
  const callbackUrl = new URL(
    "/api/runtime/connectors/execute",
    pilotCallbackUrl().origin,
  );
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
