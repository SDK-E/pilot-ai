import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";

import { createPilotConversationRuntime } from "../pilot-conversation";
import { verifyPilotRuntimeRequest } from "#runtime/auth/vercel-oidc";
import { getPilotRuntimeStorageConfig } from "#runtime/storage/pilot-runtime";

const commandSchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    workerId: z.string().uuid(),
    conversationId: z.string().uuid(),
    project: z
      .object({ id: z.string().uuid(), sharedMemoryEnabled: z.boolean() })
      .optional(),
  })
  .strict();

export const conversationDeleteRegistration = registerApiRoute(
  "/v1/conversations/delete",
  {
    method: "POST",
    requiresAuth: false,
    handler: async (c) => {
      const request = c.req.raw;

      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed." },
          {
            status: 405,
          },
        );
      }
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
          {
            status: 400,
          },
        );
      }

      const runtime = createPilotConversationRuntime(storageConfig);
      try {
        await runtime.deleteConversation({
          organizationId: command.data.organizationId,
          worker: {
            id: command.data.workerId,
            instructions: "Cleanup only.",
            modelId: "kilo/kilo-auto/free",
          },
          conversationId: command.data.conversationId,
          message: "Cleanup only.",
          baseAgentId: "conversational",
          allowedToolIds: [],
          executionId: "00000000-0000-4000-8000-000000000000",
          project: command.data.project,
        });
        return new Response(null, { status: 204 });
      } finally {
        await runtime.close();
      }
    },
  },
);
