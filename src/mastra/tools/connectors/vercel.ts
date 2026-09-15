import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  callConnector,
  connectorsExecuteUrl,
  type ConnectorToolContext,
} from "./callback.js";

const TOOL_ID = "connector-vercel";

const deploymentSchema = z.object({
  id: z.string().max(200),
  url: z.string().max(2000),
  state: z.string().max(50),
  createdAt: z.string().max(50),
});

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list-deployments"),
    limit: z.number().int().min(1).max(25).default(10),
  }),
  z.object({
    action: z.literal("project-status"),
    projectId: z.string().min(1).max(200),
  }),
]);

const outputSchema = z
  .object({
    deployments: z.array(deploymentSchema).max(25).optional(),
    project: z
      .object({
        id: z.string().max(200),
        name: z.string().max(200),
        latestDeploymentState: z.string().max(50).optional(),
        latestDeploymentUrl: z.string().max(2000).optional(),
      })
      .optional(),
  })
  .strict()
  .refine(
    (output) =>
      output.deployments !== undefined || output.project !== undefined,
    {
      message:
        "Vercel connector response is missing both deployments and project.",
    },
  );

/**
 * Reads the user's own connected Vercel account through Pilot's connectors
 * callback. Read-only; it cannot trigger, cancel, or promote deployments.
 */
export function createConnectorVercelTool(context: ConnectorToolContext) {
  const callbackUrl = connectorsExecuteUrl();
  return createTool({
    id: TOOL_ID,
    description:
      "List recent deployments or read one project's latest deployment status in the user's own connected Vercel account (read-only; cannot trigger, cancel, or promote deployments).",
    inputSchema,
    outputSchema,
    execute: async (rawInput) => {
      const result = await callConnector({
        context,
        callbackUrl,
        toolId: TOOL_ID,
        toolLabel: "Vercel",
        action: rawInput.action,
        params: rawInput,
      });
      return outputSchema.parse(result);
    },
    toModelOutput: (output) => {
      if (output.project) {
        return {
          type: "text",
          value: `**${output.project.name}**\nLatest: ${output.project.latestDeploymentState ?? "unknown"} — ${output.project.latestDeploymentUrl ?? "n/a"}`,
        };
      }
      const deployments = output.deployments ?? [];
      return {
        type: "text",
        value:
          deployments.length === 0
            ? "No deployments found."
            : deployments
                .map(
                  (deployment) =>
                    `- ${deployment.state} — ${deployment.url} (${deployment.createdAt})`,
                )
                .join("\n"),
      };
    },
  });
}
