import { z } from "zod";

import { generateConversationReplySchema } from "../../contracts/conversation.js";
import { APPROVABLE_CAPABILITY_IDS } from "../agents/base/capabilities/index.js";
import { createPilotRuntime } from "../agents/runtime/runtime.js";
import { isVerifiedPilotRuntimeRequest } from "../auth/vercel-oidc.js";
import { getPilotRuntimeStorageConfig } from "../storage/runtime.js";

import { createChatCompletionResponse } from "./openai-compatible.js";
import { readJsonBody } from "./request-body.js";
import { isPublicWebSearchEnabled } from "./runtime-selection.js";

const inputSchema = generateConversationReplySchema
  .extend({
    runtimeRunId: z.string().min(1).max(255),
    toolCallId: z.string().min(1).max(255),
    toolId: z.enum(APPROVABLE_CAPABILITY_IDS),
    approved: z.boolean(),
  })
  .strict();

function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

// Returns the caller's OIDC token, or the response that ends the request.
async function authorizeApproval(request: Request): Promise<string | Response> {
  if (request.method !== "POST") return error("Method not allowed.", 405);
  if (!(await isVerifiedPilotRuntimeRequest(request))) {
    return error("Unauthorized.", 401);
  }
  if (
    request.headers.get("x-pilot-allowed-tool-ids")?.includes("web-search") &&
    !isPublicWebSearchEnabled()
  ) {
    return error("Pilot public web search is not enabled.", 403);
  }
  return (
    request.headers.get("x-pilot-runtime-oidc-token") ??
    error("Unauthorized.", 401)
  );
}

export async function handleApprovalResume(
  request: Request,
): Promise<Response> {
  const oidcToken = await authorizeApproval(request);
  if (oidcToken instanceof Response) return oidcToken;

  const input = inputSchema.safeParse(await readJsonBody(request));
  if (!input.success) return error("Invalid approval resume command.", 400);

  const storageConfig = getPilotRuntimeStorageConfig();
  if (!storageConfig)
    return error("Pilot Conversation is not configured.", 503);

  const runtime = createPilotRuntime(storageConfig, oidcToken);
  try {
    const result = await runtime.resume(input.data, input.data.approved);
    return Response.json(
      createChatCompletionResponse({
        ...result,
        finishReason: result.finishReason ?? "stop",
      }),
    );
  } catch {
    return error("Pilot could not resume this approval.", 409);
  } finally {
    await runtime.close();
  }
}
