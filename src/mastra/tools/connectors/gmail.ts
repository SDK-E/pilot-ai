import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { callConnector, type ConnectorToolContext } from "./callback.js";

const TOOL_ID = "connector-gmail";

const messageSummarySchema = z.object({
  id: z.string().max(200),
  subject: z.string().max(500),
  from: z.string().max(300),
  snippet: z.string().max(500),
  receivedAt: z.string().max(50).optional(),
});

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search-messages"),
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  z.object({
    action: z.literal("read-message"),
    messageId: z.string().min(1).max(200),
  }),
]);

const outputSchema = z
  .object({
    items: z.array(messageSummarySchema).max(25).optional(),
    message: z
      .object({
        id: z.string().max(200),
        subject: z.string().max(500),
        from: z.string().max(300),
        to: z.string().max(500),
        receivedAt: z.string().max(50).optional(),
        body: z.string().max(8000),
      })
      .optional(),
  })
  .strict();

/**
 * Reads the user's own connected Gmail account through Pilot's connectors
 * callback. Read-only; it cannot send, reply, delete, or modify labels.
 */
export function createConnectorGmailTool(context: ConnectorToolContext) {
  return createTool({
    id: TOOL_ID,
    description:
      "Search the user's own connected Gmail messages, or read one full message by id (read-only; cannot send, reply to, delete, or otherwise modify email).",
    inputSchema,
    outputSchema,
    execute: async (rawInput) => {
      const result = await callConnector({
        context,
        toolId: TOOL_ID,
        toolLabel: "Gmail",
        action: rawInput.action,
        params: rawInput,
      });
      return outputSchema.parse(result);
    },
    toModelOutput: (output) => {
      if (output.message) {
        return {
          type: "text",
          value: `**${output.message.subject}**\nFrom: ${output.message.from}\nTo: ${output.message.to}\n\n${output.message.body}`,
        };
      }
      const items = output.items ?? [];
      return {
        type: "text",
        value:
          items.length === 0
            ? "No messages found."
            : items
                .map(
                  (item) =>
                    `- ${item.subject} — ${item.from}\n  ${item.snippet}`,
                )
                .join("\n"),
      };
    },
  });
}
