import { registerApiRoute } from "@mastra/core/server";
import { ZodError } from "zod";

import {
  createPilotConversationRuntime,
  generateConversationReplySchema,
  type GenerateConversationReply,
} from "../pilot-conversation";
import { createPilotPublicWebRuntime } from "#research/pilot-research";
import { getPilotRuntimeStorageConfig } from "#runtime/storage/pilot-runtime";
import { verifyPilotRuntimeRequest } from "#runtime/auth/vercel-oidc";

export const generateRegistration = registerApiRoute(
  "/pilot/conversations/generate",
  {
    method: "POST",
    requiresAuth: false,
    handler: async (context) => {
      if (!(await verifyPilotRuntimeRequest(context.req.raw))) {
        return context.json({ error: "Unauthorized." }, 401);
      }
      const runtimeStorageConfig = getPilotRuntimeStorageConfig();

      if (!runtimeStorageConfig) {
        return context.json(
          { error: "Pilot Conversation runtime is not configured." },
          503,
        );
      }

      let command: GenerateConversationReply;

      try {
        command = generateConversationReplySchema.parse(
          await context.req.json(),
        );
      } catch (error) {
        if (error instanceof ZodError) {
          return context.json({ error: "Invalid runtime command." }, 400);
        }

        return context.json({ error: "Invalid JSON request body." }, 400);
      }

      let runtime:
        | ReturnType<typeof createPilotConversationRuntime>
        | ReturnType<typeof createPilotPublicWebRuntime>
        | undefined;

      try {
        if (command.allowedToolIds.includes("web-search")) {
          if (process.env.PILOT_ENABLE_RESEARCH !== "true") {
            return context.json(
              { error: "Pilot public web search is not enabled." },
              403,
            );
          }
          const oidcToken = context.req.raw.headers.get(
            "x-pilot-runtime-oidc-token",
          );
          if (!oidcToken) return context.json({ error: "Unauthorized." }, 401);
          runtime = createPilotPublicWebRuntime(
            runtimeStorageConfig,
            oidcToken,
          );
        } else {
          runtime = createPilotConversationRuntime(runtimeStorageConfig);
        }
        return context.json(await runtime.generate(command));
      } finally {
        await runtime?.close();
      }
    },
  },
);
