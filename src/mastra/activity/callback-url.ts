import { z } from "zod";

const callbackUrlSchema = z.url().transform((value, context) => {
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

/**
 * The Pilot activity callback configured for this deployment. Throws when it
 * is missing or not a credential-free HTTPS URL, so callers fail closed.
 */
export function pilotCallbackUrl(): URL {
  return callbackUrlSchema.parse(
    process.env.PILOT_ACTIVITY_CALLBACK_URL?.trim(),
  );
}
