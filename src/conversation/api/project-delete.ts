import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";

import { createPilotConversationRuntime } from "../pilot-conversation";
import { verifyPilotRuntimeRequest } from "#runtime/auth/vercel-oidc";
import { getPilotRuntimeStorageConfig } from "#runtime/storage/pilot-runtime";

const commandSchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    workerId: z.string().uuid(),
    projectId: z.string().uuid(),
  })
  .strict();

export const projectDeleteRegistration = registerApiRoute(
  "/v1/projects/delete-memory",
  {
    method: "POST",
    requiresAuth: false,
    handler: async (c) => {
      const request = c.req.raw;
      if (!(await verifyPilotRuntimeRequest(request))) {
        return Response.json({ error: "Unauthorized." }, { status: 401 });
      }
      const storageConfig = getPilotRuntimeStorageConfig();
      if (!storageConfig) {
        return Response.json(
          { error: "Pilot Conversation is not configured." },
          { status: 503 },
        );
      }
      const command = commandSchema.safeParse(
        await request.json().catch(() => undefined),
      );
      if (!command.success) {
        return Response.json(
          { error: "Invalid cleanup command." },
          { status: 400 },
        );
      }
      const runtime = createPilotConversationRuntime(storageConfig);
      try {
        await runtime.deleteProjectMemory({
          organizationId: command.data.organizationId,
          worker: {
            id: command.data.workerId,
            instructions: "Cleanup only.",
            modelId: "kilo/kilo-auto/free",
          },
          project: { id: command.data.projectId, sharedMemoryEnabled: true },
        });
        return new Response(null, { status: 204 });
      } finally {
        await runtime.close();
      }
    },
  },
);
