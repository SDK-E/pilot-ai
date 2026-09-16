import { ZodError } from "zod";

import { verifyPilotRuntimeRequest } from "../auth/workos-m2m.js";
import { logger } from "../logger.js";
import {
  getPilotRuntimeStorageConfig,
  type PilotRuntimeStorageConfig,
} from "../storage/runtime.js";

import {
  createChatCompletionResponse,
  createChatCompletionStream,
  createConversationCommandFromChatCompletion,
  createUserInputRequiredResponse,
  isStreamingChatCompletionRequest,
} from "./openai-compatible.js";
import {
  selectConversationRuntime,
  type ConversationRuntime,
} from "./runtime-selection.js";

import type { GenerateConversationReply } from "../../contracts/conversation.js";

const streamHeaders = {
  "cache-control": "no-cache, no-transform",
  "content-type": "text/event-stream; charset=utf-8",
  connection: "keep-alive",
};

interface ParsedChatCompletion {
  body: unknown;
  command: GenerateConversationReply;
}

function error(message: string, type: string, status: number): Response {
  return Response.json({ error: { message, type } }, { status });
}

async function authorize(
  request: Request,
): Promise<PilotRuntimeStorageConfig | Response> {
  if (request.method !== "POST") {
    return error("Method not allowed.", "invalid_request_error", 405);
  }
  const verification = await verifyPilotRuntimeRequest(request);
  if (!verification.ok) {
    return error(
      `Unauthorized: ${verification.reason}`,
      "authentication_error",
      401,
    );
  }
  return (
    getPilotRuntimeStorageConfig() ??
    error("Pilot Conversation is not configured.", "server_error", 503)
  );
}

async function parseChatCompletion(
  request: Request,
): Promise<ParsedChatCompletion | Response> {
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
  try {
    const command = createConversationCommandFromChatCompletion(
      body,
      request.headers,
    );
    return { body, command };
  } catch (error_) {
    return error(
      error_ instanceof ZodError || error_ instanceof Error
        ? error_.message
        : "Invalid chat completion request.",
      "invalid_request_error",
      400,
    );
  }
}

async function generateCompletion(
  runtime: ConversationRuntime,
  command: GenerateConversationReply,
  abortSignal: AbortSignal,
): Promise<Response> {
  const result = await runtime.generate(command, abortSignal);
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
}

function streamResponse(
  stream: Awaited<ReturnType<ConversationRuntime["stream"]>>,
  body: unknown,
  runtime: ConversationRuntime,
): Response {
  const isIncludeUsage =
    (body as { stream_options?: { include_usage?: boolean } }).stream_options
      ?.include_usage === true;
  return new Response(
    createChatCompletionStream(stream, {
      includeUsage: isIncludeUsage,
      onClose: () => runtime.close(),
    }),
    { headers: streamHeaders },
  );
}

/**
 * OpenAI-compatible chat completion over the protected Pilot runtime.
 * A streaming response owns the runtime until the stream closes.
 */
export async function handleChatCompletion(
  request: Request,
): Promise<Response> {
  const storageConfig = await authorize(request);
  if (storageConfig instanceof Response) return storageConfig;

  const parsed = await parseChatCompletion(request);
  if (parsed instanceof Response) return parsed;

  const selection = await selectConversationRuntime(
    parsed.command,
    request.headers.get("x-pilot-runtime-token"),
    storageConfig,
  );
  if (!selection.ok) {
    return error(selection.message, selection.type, selection.status);
  }
  const { runtime } = selection;

  let isCloseRuntime = true;
  try {
    if (!isStreamingChatCompletionRequest(parsed.body)) {
      return await generateCompletion(runtime, parsed.command, request.signal);
    }
    const stream = await runtime.stream(parsed.command, request.signal);
    isCloseRuntime = false;
    return streamResponse(stream, parsed.body, runtime);
  } catch (error_) {
    logger.error("Chat completion failed.", {
      errorName: error_ instanceof Error ? error_.name : "unknown",
    });
    return error("Pilot Conversation could not complete.", "server_error", 502);
  } finally {
    if (isCloseRuntime) await runtime.close();
  }
}
