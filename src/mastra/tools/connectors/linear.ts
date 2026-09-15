import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { callConnector, type ConnectorToolContext } from "./callback.js";

const TOOL_ID = "connector-linear";

const issueSchema = z.object({
  id: z.string().max(200),
  identifier: z.string().max(50),
  title: z.string().max(500),
  url: z.string().max(2000),
  state: z.string().max(50),
  updatedAt: z.string().max(50),
});

const inputSchema = z.object({
  action: z.literal("search-issues"),
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(25).default(10),
});

const outputSchema = z.object({ items: z.array(issueSchema).max(25) }).strict();

/**
 * Reads the user's own connected Linear workspace through Pilot's
 * connectors callback. Read-only; it cannot create, edit, or close issues.
 */
export function createConnectorLinearTool(context: ConnectorToolContext) {
  return createTool({
    id: TOOL_ID,
    description:
      "Search issues in the user's own connected Linear workspace (read-only; cannot create, edit, or close issues).",
    inputSchema,
    outputSchema,
    execute: async (rawInput) => {
      const result = await callConnector({
        context,
        toolId: TOOL_ID,
        toolLabel: "Linear",
        action: rawInput.action,
        params: rawInput,
      });
      return outputSchema.parse(result);
    },
    toModelOutput: (output) => ({
      type: "text",
      value:
        output.items.length === 0
          ? "No issues found."
          : output.items
              .map(
                (item) =>
                  `- ${item.identifier} ${item.title} (${item.state}) — ${item.url}`,
              )
              .join("\n"),
    }),
  });
}
