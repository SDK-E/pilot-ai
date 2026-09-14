import type { ProcessInputArgs } from "@mastra/core/processors";

/**
 * The text of the most recent user message, or an empty string.
 */
export function latestUserText(messages: ProcessInputArgs["messages"]): string {
  const message = messages.findLast((item) => item.role === "user");
  if (!message) return "";
  const parts = message.content.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("\n")
    .trim();
  return parts || (message.content.content ?? "");
}
