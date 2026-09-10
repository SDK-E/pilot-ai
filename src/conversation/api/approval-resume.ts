import { z } from "zod";

import { createPilotProductionToolRuntime } from "../../research/pilot-research.js";
import { generateConversationReplySchema } from "../command.js";
import { createChatCompletionResponse } from "../openai-compatible.js";
import { verifyPilotRuntimeRequest } from "../../runtime/auth/vercel-oidc.js";
import { getPilotRuntimeStorageConfig } from "../../runtime/storage/pilot-runtime.js";

const inputSchema = generateConversationReplySchema
  .extend({
    runtimeRunId: z.string().min(1).max(255),
    toolCallId: z.string().min(1).max(255),
    toolId: z.enum(["web-search", "scratchpad"]),
    approved: z.boolean(),
  })
  .strict();

export async function handleApprovalResume(
  request: Request,
): Promise<Response> {
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  if (!(await verifyPilotRuntimeRequest(request)))
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (
    request.headers.get("x-pilot-allowed-tool-ids")?.includes("web-search") &&
    process.env.PILOT_ENABLE_RESEARCH !== "true"
  )
    return Response.json(
      { error: "Pilot public web search is not enabled." },
      { status: 403 },
    );
  const oidcToken = request.headers.get("x-pilot-runtime-oidc-token");
  if (!oidcToken)
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  const input = inputSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!input.success)
    return Response.json(
      { error: "Invalid approval resume command." },
      { status: 400 },
    );
  const storageConfig = getPilotRuntimeStorageConfig();
  if (!storageConfig)
    return Response.json(
      { error: "Pilot Conversation is not configured." },
      { status: 503 },
    );
  const runtime = createPilotProductionToolRuntime(storageConfig, oidcToken);
  try {
    const result = await runtime.resume(input.data, input.data.approved);
    return Response.json(
      createChatCompletionResponse({
        ...result,
        finishReason: result.finishReason ?? "stop",
      }),
    );
  } catch {
    return Response.json(
      { error: "Pilot could not resume this approval." },
      { status: 409 },
    );
  } finally {
    await runtime.close();
  }
}
