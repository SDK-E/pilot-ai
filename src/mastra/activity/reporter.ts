import { z } from "zod";

import { ALLOWED_TOOL_IDS } from "../../contracts/conversation.js";

import { pilotCallbackUrl } from "./callback-url.js";

const toolActivitySchema = z
  .object({
    kind: z.literal("tool"),
    organizationId: z.string().min(1).max(255),
    executionId: z.uuid(),
    toolId: z.enum(ALLOWED_TOOL_IDS),
    toolCallId: z.string().min(1).max(255).optional(),
    state: z.enum(["started", "completed", "failed"]),
    runtimeRunId: z.string().min(1).max(255).optional(),
    detail: z.string().max(4000).optional(),
  })
  .strict();

const skillActivitySchema = z
  .object({
    kind: z.literal("skill"),
    organizationId: z.string().min(1).max(255),
    executionId: z.uuid(),
    skillId: z.string().regex(/^[a-z0-9][a-z0-9._/-]{0,120}$/i),
  })
  .strict();

type ActivityEvent =
  z.infer<typeof toolActivitySchema> | z.infer<typeof skillActivitySchema>;

export function createPilotActivityReporter(runtimeToken: string) {
  const callbackUrl = pilotCallbackUrl();

  return async (event: ActivityEvent): Promise<void> => {
    const validated =
      event.kind === "tool"
        ? toolActivitySchema.parse(event)
        : skillActivitySchema.parse(event);
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pilot-runtime-token": runtimeToken,
      },
      body: JSON.stringify(validated),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Pilot activity callback returned ${response.status}.`);
    }
  };
}
