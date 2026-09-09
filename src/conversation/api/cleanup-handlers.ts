import { z } from "zod";

import { createPilotConversationRuntime } from "../pilot-conversation.js";
import { verifyPilotRuntimeRequest } from "../../runtime/auth/vercel-oidc.js";
import { getPilotRuntimeStorageConfig } from "../../runtime/storage/pilot-runtime.js";

export const conversationCleanupSchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    workerId: z.uuid(),
    conversationId: z.uuid(),
    project: z
      .object({ id: z.uuid(), sharedMemoryEnabled: z.boolean() })
      .optional(),
  })
  .strict();

export const projectMemoryCleanupSchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    workerId: z.uuid(),
    projectId: z.uuid(),
  })
  .strict();

async function authorizeAndParse<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  if (!(await verifyPilotRuntimeRequest(request)))
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  const command = schema.safeParse(await request.json().catch(() => undefined));
  return command.success
    ? command.data
    : Response.json({ error: "Invalid cleanup command." }, { status: 400 });
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function getStorageResponse() {
  const storageConfig = getPilotRuntimeStorageConfig();
  return (
    storageConfig ??
    Response.json(
      { error: "Pilot Conversation is not configured." },
      { status: 503 },
    )
  );
}

export async function handleConversationCleanup(
  request: Request,
): Promise<Response> {
  const command = await authorizeAndParse(request, conversationCleanupSchema);
  if (isResponse(command)) return command;
  const storageConfig = getStorageResponse();
  if (isResponse(storageConfig)) return storageConfig;
  const runtime = createPilotConversationRuntime(storageConfig);
  try {
    await runtime.deleteConversation({
      organizationId: command.organizationId,
      worker: {
        id: command.workerId,
        instructions: "Cleanup only.",
        modelId: "kilo/kilo-auto/free",
      },
      conversationId: command.conversationId,
      message: "Cleanup only.",
      baseAgentId: "conversational",
      allowedToolIds: [],
      executionId: "00000000-0000-4000-8000-000000000000",
      project: command.project,
    });
    return new Response(null, { status: 204 });
  } finally {
    await runtime.close();
  }
}

export async function handleProjectMemoryCleanup(
  request: Request,
): Promise<Response> {
  const command = await authorizeAndParse(request, projectMemoryCleanupSchema);
  if (isResponse(command)) return command;
  const storageConfig = getStorageResponse();
  if (isResponse(storageConfig)) return storageConfig;
  const runtime = createPilotConversationRuntime(storageConfig);
  try {
    await runtime.deleteProjectMemory({
      organizationId: command.organizationId,
      worker: {
        id: command.workerId,
        instructions: "Cleanup only.",
        modelId: "kilo/kilo-auto/free",
      },
      project: { id: command.projectId, sharedMemoryEnabled: true },
    });
    return new Response(null, { status: 204 });
  } finally {
    await runtime.close();
  }
}
