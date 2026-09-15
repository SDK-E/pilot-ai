import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { callConnector, type ConnectorToolContext } from "./callback.js";

const TOOL_ID = "connector-notion";

const pageSummarySchema = z.object({
  id: z.string().max(200),
  title: z.string().max(500),
  url: z.string().max(2000),
  lastEditedAt: z.string().max(50).optional(),
});

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search-pages"),
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  z.object({
    action: z.literal("read-page"),
    pageId: z.string().min(1).max(200),
  }),
]);

const outputSchema = z
  .object({
    items: z.array(pageSummarySchema).max(25).optional(),
    page: z
      .object({
        id: z.string().max(200),
        title: z.string().max(500),
        url: z.string().max(2000),
        content: z.string().max(8000),
      })
      .optional(),
  })
  .strict();

/**
 * Reads the user's own connected Notion workspace through Pilot's
 * connectors callback. Read-only; it cannot create, edit, or delete pages.
 */
export function createConnectorNotionTool(context: ConnectorToolContext) {
  return createTool({
    id: TOOL_ID,
    description:
      "Search pages or read one page's content in the user's own connected Notion workspace (read-only; cannot create, edit, or delete pages).",
    inputSchema,
    outputSchema,
    execute: async (rawInput) => {
      const result = await callConnector({
        context,
        toolId: TOOL_ID,
        toolLabel: "Notion",
        action: rawInput.action,
        params: rawInput,
      });
      return outputSchema.parse(result);
    },
    toModelOutput: (output) => {
      if (output.page) {
        return {
          type: "text",
          value: `**${output.page.title}**\n${output.page.url}\n\n${output.page.content}`,
        };
      }
      const items = output.items ?? [];
      return {
        type: "text",
        value:
          items.length === 0
            ? "No pages found."
            : items.map((item) => `- ${item.title} — ${item.url}`).join("\n"),
      };
    },
  });
}
