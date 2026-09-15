import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { pilotCallbackUrl } from "../../activity/callback-url.js";

import type { GenerateConversationReply } from "../../../contracts/conversation.js";

const stepSchema = z.object({
  id: z.string().max(100),
  text: z.string().max(300),
  status: z.enum(["pending", "in_progress", "done"]),
});
const responseSchema = z
  .object({ steps: z.array(stepSchema).max(20) })
  .strict();

export function createPilotPlanTool(input: {
  command: GenerateConversationReply;
  runtimeToken: string;
}) {
  const callbackUrl = new URL("/api/runtime/plan", pilotCallbackUrl().origin);

  return createTool({
    id: "plan",
    description:
      "Read or replace the visible, step-by-step plan for this conversation. Call it with the full step list every time it changes, so the user always sees current, accurate progress. Keep each step short and factual; never include secrets, tool output, or private data.",
    inputSchema: z.object({
      action: z.enum(["read", "write"]),
      steps: z.array(stepSchema).max(20).optional(),
    }),
    outputSchema: responseSchema,
    execute: async ({ action, steps }) => {
      if (action === "write" && steps === undefined) {
        throw new Error("A plan write requires steps.");
      }
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pilot-runtime-token": input.runtimeToken,
        },
        body: JSON.stringify({
          organizationId: input.command.organizationId,
          executionId: input.command.executionId,
          action,
          ...(steps !== undefined && { steps }),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Pilot plan callback returned ${response.status}.`);
      }
      return responseSchema.parse(await response.json());
    },
    toModelOutput: (output) => ({
      type: "text",
      value: JSON.stringify(output.steps),
    }),
  });
}
