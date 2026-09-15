import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { callConnector, type ConnectorToolContext } from "./callback.js";

const TOOL_ID = "connector-github";

const issueSchema = z.object({
  number: z.number().int(),
  title: z.string().max(500),
  url: z.string().max(2000),
  state: z.string().max(50),
  updatedAt: z.string().max(50),
});

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search-issues"),
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  z.object({
    action: z.literal("list-repository-issues"),
    owner: z.string().min(1).max(100),
    repo: z.string().min(1).max(100),
    limit: z.number().int().min(1).max(25).default(10),
  }),
]);

const outputSchema = z.object({ items: z.array(issueSchema).max(25) }).strict();

/**
 * Reads the user's own connected GitHub account through Pilot's connectors
 * callback. This is distinct from the unauthenticated `githubPublic` tool
 * bundled under the `web-search` capability: `githubPublic` calls GitHub's
 * public REST API directly and only sees what's public, while this tool goes
 * through the user's authorized connection and can see private repositories
 * they have access to. Read-only; it cannot open, close, comment on, or
 * otherwise modify anything on GitHub.
 */
export function createConnectorGithubTool(context: ConnectorToolContext) {
  return createTool({
    id: TOOL_ID,
    description:
      "Search issues or list a repository's issues through the user's own connected GitHub account (read-only; cannot create, edit, close, or comment). Distinct from githubPublic, which only reads GitHub's public API without any account connection.",
    inputSchema,
    outputSchema,
    execute: async (rawInput) => {
      const result = await callConnector({
        context,
        toolId: TOOL_ID,
        toolLabel: "GitHub",
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
                  `- #${String(item.number)} ${item.title} (${item.state}) — ${item.url}`,
              )
              .join("\n"),
    }),
  });
}
