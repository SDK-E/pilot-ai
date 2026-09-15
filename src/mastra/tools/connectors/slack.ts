import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { callConnector, type ConnectorToolContext } from "./callback.js";

const TOOL_ID = "connector-slack";

const channelSchema = z.object({
  id: z.string().max(50),
  name: z.string().max(200),
  topic: z.string().max(500).optional(),
});

const messageSchema = z.object({
  id: z.string().max(50),
  user: z.string().max(200),
  text: z.string().max(2000),
  postedAt: z.string().max(50).optional(),
});

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list-channels"),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  z.object({
    action: z.literal("read-recent-messages"),
    channelId: z.string().min(1).max(50),
    limit: z.number().int().min(1).max(25).default(10),
  }),
]);

const outputSchema = z
  .object({
    channels: z.array(channelSchema).max(25).optional(),
    messages: z.array(messageSchema).max(25).optional(),
  })
  .strict();

/**
 * Reads the user's own connected Slack workspace through Pilot's connectors
 * callback. Read-only; it cannot post, edit, or delete messages.
 */
export function createConnectorSlackTool(context: ConnectorToolContext) {
  return createTool({
    id: TOOL_ID,
    description:
      "List channels or read a channel's recent messages in the user's own connected Slack workspace (read-only; cannot post, edit, or delete messages).",
    inputSchema,
    outputSchema,
    execute: async (rawInput) => {
      const result = await callConnector({
        context,
        toolId: TOOL_ID,
        toolLabel: "Slack",
        action: rawInput.action,
        params: rawInput,
      });
      return outputSchema.parse(result);
    },
    toModelOutput: (output) => {
      if (output.channels) {
        return {
          type: "text",
          value:
            output.channels.length === 0
              ? "No channels found."
              : output.channels
                  .map((channel) => `- #${channel.name} (${channel.id})`)
                  .join("\n"),
        };
      }
      const messages = output.messages ?? [];
      return {
        type: "text",
        value:
          messages.length === 0
            ? "No messages found."
            : messages
                .map((message) => `- ${message.user}: ${message.text}`)
                .join("\n"),
      };
    },
  });
}
