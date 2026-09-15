import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  callConnector,
  connectorsExecuteUrl,
  type ConnectorToolContext,
} from "./callback.js";

const TOOL_ID = "connector-monday";

const boardSchema = z.object({
  id: z.string().max(50),
  name: z.string().max(200),
  itemsCount: z.number().int().optional(),
});

const itemSchema = z.object({
  id: z.string().max(50),
  name: z.string().max(300),
  state: z.string().max(50).optional(),
  updatedAt: z.string().max(50).optional(),
});

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list-boards"),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  z.object({
    action: z.literal("query-items"),
    boardId: z.string().min(1).max(50),
    limit: z.number().int().min(1).max(25).default(10),
  }),
]);

const outputSchema = z
  .object({
    boards: z.array(boardSchema).max(25).optional(),
    items: z.array(itemSchema).max(25).optional(),
  })
  .strict()
  .refine(
    (output) => output.boards !== undefined || output.items !== undefined,
    {
      message:
        "Monday.com connector response is missing both boards and items.",
    },
  );

/**
 * Reads the user's own connected Monday.com account through Pilot's
 * connectors callback. Read-only; it cannot create, edit, or delete
 * boards or items.
 */
export function createConnectorMondayTool(context: ConnectorToolContext) {
  const callbackUrl = connectorsExecuteUrl();
  return createTool({
    id: TOOL_ID,
    description:
      "List boards or query a board's items in the user's own connected Monday.com account (read-only; cannot create, edit, or delete boards or items).",
    inputSchema,
    outputSchema,
    execute: async (rawInput) => {
      const result = await callConnector({
        context,
        callbackUrl,
        toolId: TOOL_ID,
        toolLabel: "Monday.com",
        action: rawInput.action,
        params: rawInput,
      });
      return outputSchema.parse(result);
    },
    toModelOutput: (output) => {
      if (output.boards) {
        return {
          type: "text",
          value:
            output.boards.length === 0
              ? "No boards found."
              : output.boards
                  .map(
                    (board) =>
                      `- ${board.name} (${String(board.itemsCount ?? 0)} items)`,
                  )
                  .join("\n"),
        };
      }
      const items = output.items ?? [];
      return {
        type: "text",
        value:
          items.length === 0
            ? "No items found."
            : items
                .map((item) => `- ${item.name} (${item.state ?? "unknown"})`)
                .join("\n"),
      };
    },
  });
}
