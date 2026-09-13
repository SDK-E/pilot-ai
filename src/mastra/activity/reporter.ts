import { z } from "zod";

const callbackUrlSchema = z
  .string()
  .url()
  .transform((value, context) => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      context.addIssue({
        code: "custom",
        message: "Activity callback must be a credential-free HTTPS URL.",
      });
      return z.NEVER;
    }
    return url;
  });

const toolActivitySchema = z
  .object({
    kind: z.literal("tool"),
    organizationId: z.string().min(1).max(255),
    executionId: z.string().uuid(),
    toolId: z.enum(["web-search", "scratchpad", "ask-user"]),
    toolCallId: z.string().min(1).max(255).optional(),
    state: z.enum(["started", "completed", "failed", "awaiting_approval"]),
    runtimeRunId: z.string().min(1).max(255).optional(),
  })
  .strict();

const skillActivitySchema = z
  .object({
    kind: z.literal("skill"),
    organizationId: z.string().min(1).max(255),
    executionId: z.string().uuid(),
    skillId: z.string().regex(/^[a-z0-9][a-z0-9._/-]{0,120}$/i),
  })
  .strict();

type ActivityEvent =
  z.infer<typeof toolActivitySchema> | z.infer<typeof skillActivitySchema>;

export function runtimeSkillsEnabled(): boolean {
  return process.env.PILOT_ENABLE_RUNTIME_SKILLS === "true";
}

export function createPilotActivityReporter(oidcToken: string) {
  const callbackUrl = callbackUrlSchema.parse(
    process.env.PILOT_ACTIVITY_CALLBACK_URL?.trim(),
  );

  return async (event: ActivityEvent): Promise<void> => {
    const validated =
      event.kind === "tool"
        ? toolActivitySchema.parse(event)
        : skillActivitySchema.parse(event);
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pilot-runtime-oidc-token": oidcToken,
      },
      body: JSON.stringify(validated),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Pilot activity callback returned ${response.status}.`);
    }
  };
}
