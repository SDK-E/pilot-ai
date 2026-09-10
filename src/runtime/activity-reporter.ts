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

const activitySchema = z
  .object({
    organizationId: z.string().min(1).max(255),
    executionId: z.string().uuid(),
    toolId: z.enum(["web-search", "scratchpad", "ask-user"]),
    toolCallId: z.string().min(1).max(255).optional(),
    state: z.enum(["started", "completed", "failed", "awaiting_approval"]),
    runtimeRunId: z.string().min(1).max(255).optional(),
  })
  .strict();

type ActivityEvent = z.infer<typeof activitySchema>;

export function createPilotActivityReporter(oidcToken: string) {
  const callbackUrl = callbackUrlSchema.parse(
    process.env.PILOT_ACTIVITY_CALLBACK_URL?.trim(),
  );

  return async (event: ActivityEvent): Promise<void> => {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pilot-runtime-oidc-token": oidcToken,
      },
      body: JSON.stringify(event),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Pilot activity callback returned ${response.status}.`);
    }
  };
}
