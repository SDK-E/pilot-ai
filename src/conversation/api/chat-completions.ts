import { registerApiRoute } from "@mastra/core/server";
import { ZodError } from "zod";

import {
  createApprovalRequiredResponse,
  createChatCompletionResponse,
  createChatCompletionStream,
  createConversationCommandFromChatCompletion,
  createUserInputRequiredResponse,
  isStreamingChatCompletionRequest,
} from "#conversation/openai-compatible";
import { createPilotProductionToolRuntime } from "#research/pilot-research";
import { verifyPilotRuntimeRequest } from "#runtime/auth/vercel-oidc";
import { getPilotRuntimeStorageConfig } from "#runtime/storage/pilot-runtime";

import { createPilotConversationRuntime } from "../pilot-conversation.js";

function error(message: string, type: string, status: number): Response {
  return Response.json({ error: { message, type } }, { status });
}

export const chatCompletionsRegistration = registerApiRoute(
  "/v1/chat/completions",
  {
    method: "POST",
    requiresAuth: false,
    handler: async (c) => {
      const request = c.req.raw;

      if (request.method !== "POST") {
        return error("Method not allowed.", "invalid_request_error", 405);
      }
      if (!(await verifyPilotRuntimeRequest(request))) {
        return error("Unauthorized.", "authentication_error", 401);
      }

      const storageConfig = getPilotRuntimeStorageConfig();
      if (!storageConfig) {
        return error(
          "Pilot Conversation is not configured.",
          "server_error",
          503,
        );
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return error(
          "Request body must be valid JSON.",
          "invalid_request_error",
          400,
        );
      }

      let command;
      try {
        command = createConversationCommandFromChatCompletion(
          body,
          request.headers,
        );
      } catch (error_) {
        return error(
          error_ instanceof ZodError || error_ instanceof Error
            ? error_.message
            : "Invalid chat completion request.",
          "invalid_request_error",
          400,
        );
      }

      let runtime:
        | ReturnType<typeof createPilotConversationRuntime>
        | ReturnType<typeof createPilotProductionToolRuntime>
        | undefined;
      let isCloseRuntime = true;

      try {
        const oidcToken = request.headers.get("x-pilot-runtime-oidc-token");
        if (command.allowedToolIds.length > 0) {
          if (
            command.allowedToolIds.includes("web-search") &&
            process.env.PILOT_ENABLE_RESEARCH !== "true"
          ) {
            return error(
              "Pilot public web search is not enabled.",
              "invalid_request_error",
              403,
            );
          }
          if (!oidcToken) {
            return error("Unauthorized.", "authentication_error", 401);
          }
          runtime = createPilotProductionToolRuntime(storageConfig, oidcToken);
        } else {
          runtime = createPilotConversationRuntime(
            storageConfig,
            oidcToken ?? undefined,
          );
        }

        if (isStreamingChatCompletionRequest(body)) {
          const stream = await runtime.stream(command);
          isCloseRuntime = false;
          const isIncludeUsage =
            (body as { stream_options?: { include_usage?: boolean } })
              ?.stream_options?.include_usage === true;

          return new Response(
            createChatCompletionStream(stream, {
              includeUsage: isIncludeUsage,
              onClose: async () => {
                await runtime?.close();
              },
            }),
            {
              headers: {
                "cache-control": "no-cache, no-transform",
                "content-type": "text/event-stream; charset=utf-8",
                connection: "keep-alive",
              },
            },
          );
        }

        const result = await runtime.generate(command);
        if (result.kind === "suspended") {
          return Response.json(createApprovalRequiredResponse(result));
        }
        if (result.kind === "user_input_required") {
          return Response.json(createUserInputRequiredResponse(result));
        }
        if (!("text" in result)) {
          return error(
            "Pilot Conversation returned an invalid result.",
            "server_error",
            502,
          );
        }
        return Response.json(createChatCompletionResponse(result));
      } catch (error_) {
        console.error(
          "[pilot-conversation] generation failed:",
          error_ instanceof Error ? error_.name : "unknown error",
        );
        return error(
          "Pilot Conversation could not complete.",
          "server_error",
          502,
        );
      } finally {
        if (isCloseRuntime) {
          await runtime?.close();
        }
      }
    },
  },
);
