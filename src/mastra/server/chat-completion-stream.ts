import { htmlSniffFilter } from "./html-sniff-filter.js";

import type { RuntimeResult } from "../agents/runtime/results.js";

export interface StreamingConversationResult {
  runId: string | null;
  modelId: string;
  textStream: AsyncIterable<string>;
  result(): Promise<RuntimeResult>;
}

// The deployed function has a 90-second ceiling. Leave enough time for Pilot
// to emit a structured error and release the runtime before Vercel terminates
// the request. A resolved result clears the timer immediately.
const STREAM_RESULT_TIMEOUT_MS = 80_000;

export function waitForStreamingResult<T>(result: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Pilot Conversation runtime did not complete in time."));
    }, STREAM_RESULT_TIMEOUT_MS);

    void result
      .then(resolve)
      .catch(reject)
      .finally(() => {
        clearTimeout(timer);
      });
  });
}

function terminalEvent(
  id: string,
  model: string,
  completed: RuntimeResult,
): object {
  if (completed.kind === "suspended") {
    return {
      id,
      object: "pilot.approval.required",
      model,
      pilot: {
        run_id: completed.runId,
        tool_call_id: completed.toolCallId,
        tool_id: completed.toolId,
      },
    };
  }
  if (completed.kind === "user_input_required") {
    return {
      id,
      object: "pilot.user_input.required",
      model,
      pilot: {
        run_id: completed.runId,
        tool_call_id: completed.toolCallId,
        question: completed.question,
        options: completed.options,
        selection_mode: completed.selectionMode,
      },
    };
  }
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: completed.finishReason === "stop" ? "stop" : "length",
      },
    ],
  };
}

function openAiUsage(
  usage: Extract<RuntimeResult, { kind: "completed" }>["usage"],
) {
  return {
    prompt_tokens: usage.inputTokens,
    completion_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
  };
}

export function createChatCompletionStream(
  result: StreamingConversationResult,
  options: { includeUsage: boolean; onClose: () => Promise<void> },
) {
  const encoder = new TextEncoder();
  const id = `chatcmpl_${result.runId ?? crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = result.modelId;
  const send = (value: unknown) =>
    encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
  const contentChunk = (content: string) =>
    send({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta: { content }, finish_reason: null }],
    });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const htmlSniff = htmlSniffFilter();
        for await (const text of result.textStream) {
          if (!text) continue;
          const releasable = htmlSniff.push(text);
          if (releasable) controller.enqueue(contentChunk(releasable));
        }
        const remainder = htmlSniff.flush();
        if (remainder) controller.enqueue(contentChunk(remainder));
        const completed = await waitForStreamingResult(result.result());
        controller.enqueue(send(terminalEvent(id, model, completed)));
        if (completed.kind === "completed" && options.includeUsage) {
          controller.enqueue(
            send({
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [],
              usage: openAiUsage(completed.usage),
            }),
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        await options.onClose();
      }
    },
  });
}
