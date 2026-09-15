import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  callConnector,
  connectorsExecuteUrl,
  type ConnectorToolContext,
} from "./callback.js";

const TOOL_ID = "connector-google-drive";

const fileSummarySchema = z.object({
  id: z.string().max(200),
  name: z.string().max(500),
  url: z.string().max(2000),
  mimeType: z.string().max(200),
  modifiedAt: z.string().max(50).optional(),
});

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  z.object({
    action: z.literal("read-file"),
    fileId: z.string().min(1).max(200),
  }),
]);

const outputSchema = z
  .object({
    items: z.array(fileSummarySchema).max(25).optional(),
    file: z
      .object({
        id: z.string().max(200),
        name: z.string().max(500),
        mimeType: z.string().max(200),
        content: z.string().max(8000),
      })
      .optional(),
  })
  .strict()
  .refine((output) => output.items !== undefined || output.file !== undefined, {
    message: "Google Drive connector response is missing both items and file.",
  });

/**
 * Reads the user's own connected Google Drive through Pilot's connectors
 * callback. Read-only; it cannot create, edit, move, share, or delete files.
 */
export function createConnectorGoogleDriveTool(context: ConnectorToolContext) {
  const callbackUrl = connectorsExecuteUrl();
  return createTool({
    id: TOOL_ID,
    description:
      "Search the user's own connected Google Drive, or read one file's content, by file id (read-only; cannot create, edit, move, share, or delete anything).",
    inputSchema,
    outputSchema,
    execute: async (rawInput) => {
      const result = await callConnector({
        context,
        callbackUrl,
        toolId: TOOL_ID,
        toolLabel: "Google Drive",
        action: rawInput.action,
        params: rawInput,
      });
      return outputSchema.parse(result);
    },
    toModelOutput: (output) => {
      if (output.file) {
        return {
          type: "text",
          value: `**${output.file.name}** (${output.file.mimeType})\n\n${output.file.content}`,
        };
      }
      const items = output.items ?? [];
      return {
        type: "text",
        value:
          items.length === 0
            ? "No files found."
            : items
                .map(
                  (item) => `- ${item.name} (${item.mimeType}) — ${item.url}`,
                )
                .join("\n"),
      };
    },
  });
}
