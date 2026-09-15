import { z } from "zod";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isSecure(url: URL): boolean {
  return url.protocol === "https:" || LOOPBACK_HOSTNAMES.has(url.hostname);
}

const callbackUrlSchema = z.url().transform((value, context) => {
  const url = new URL(value);
  if (!isSecure(url) || url.username || url.password) {
    context.addIssue({
      code: "custom",
      message:
        "Pilot callback must be a credential-free HTTPS URL (or loopback HTTP for local development).",
    });
    return z.NEVER;
  }
  return url;
});

/**
 * The Pilot activity callback configured for this deployment. Throws when it
 * is missing or not a credential-free HTTPS URL (loopback HTTP is allowed
 * for local development), so callers fail closed.
 */
export function pilotCallbackUrl(): URL {
  return callbackUrlSchema.parse(
    process.env.PILOT_ACTIVITY_CALLBACK_URL?.trim(),
  );
}
