import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import type { GenerateConversationReply } from "#conversation/command";

const callbackUrlSchema = z
  .string()
  .url()
  .transform((value, context) => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      context.addIssue({
        code: "custom",
        message: "Pilot callback must be a credential-free HTTPS URL.",
      });
      return z.NEVER;
    }
    return url;
  });

const responseSchema = z.object({ content: z.string().max(16_000) }).strict();

export function createPilotScratchpadTool(input: {
  command: GenerateConversationReply;
  oidcToken: string;
}) {
  const activityCallback = callbackUrlSchema.parse(
    process.env.PILOT_ACTIVITY_CALLBACK_URL?.trim(),
  );
  const callbackUrl = new URL(
    "/api/runtime/scratchpad",
    activityCallback.origin,
  );

  return createTool({
    id: "scratchpad",
    description:
      "Read or update the private working scratchpad for this chat. Use it to preserve concise, useful working state for this conversation only. Never store secrets, raw tool outputs, or private data unrelated to the user's request.",
    inputSchema: z.object({
      action: z.enum(["read", "write"]),
      content: z.string().max(16_000).optional(),
    }),
    outputSchema: responseSchema,
    execute: async ({ action, content }) => {
      if (action === "write" && content === undefined) {
        throw new Error("A scratchpad write requires content.");
      }
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pilot-runtime-oidc-token": input.oidcToken,
        },
        body: JSON.stringify({
          organizationId: input.command.organizationId,
          executionId: input.command.executionId,
          action,
          ...(content === undefined ? {} : { content }),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          `Pilot scratchpad callback returned ${response.status}.`,
        );
      }
      return responseSchema.parse(await response.json());
    },
    toModelOutput: (output) => ({ type: "text", value: output.content }),
  });
}
