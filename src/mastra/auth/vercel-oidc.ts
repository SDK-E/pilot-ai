import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

const teamSlug = "sdk-enterprises";
const teamIssuer = `https://oidc.vercel.com/${teamSlug}`;
const globalIssuer = "https://oidc.vercel.com";
const audience = `https://vercel.com/${teamSlug}`;
const sourceProject = "pilot";
const tokenHeader = "x-pilot-runtime-oidc-token";

const verificationKeysByIssuer = new Map([
  [teamIssuer, createRemoteJWKSet(new URL(`${teamIssuer}/.well-known/jwks`))],
  [
    globalIssuer,
    createRemoteJWKSet(new URL(`${globalIssuer}/.well-known/jwks`)),
  ],
]);

function deploymentEnvironment(): "preview" | "production" | undefined {
  const environment = process.env.VERCEL_ENV;
  return environment === "preview" || environment === "production"
    ? environment
    : undefined;
}

/**
 * Accept only a short-lived Vercel OIDC token issued to the Pilot deployment
 * in the matching Vercel environment. Pilot forwards this token after its
 * WorkOS session and tenant authorization checks have completed.
 */
export async function isVerifiedPilotRuntimeRequest(
  request: Request,
): Promise<boolean> {
  const result = await verifyPilotRuntimeRequest(request);
  return result.ok;
}

function issuerAndKeys(
  token: string,
):
  | { issuer: string; verificationKeys: ReturnType<typeof createRemoteJWKSet> }
  | undefined {
  const decoded = decodeJwt(token);
  if (typeof decoded.iss !== "string") return undefined;
  const verificationKeys = verificationKeysByIssuer.get(decoded.iss);
  return verificationKeys
    ? { issuer: decoded.iss, verificationKeys }
    : undefined;
}

async function verifySignature(
  token: string,
  environment: "preview" | "production",
): Promise<{ ok: boolean; reason: string }> {
  const found = issuerAndKeys(token);
  if (!found) return { ok: false, reason: "bad-issuer" };

  try {
    await jwtVerify(token, found.verificationKeys, {
      issuer: found.issuer,
      audience,
      subject: `owner:${teamSlug}:project:${sourceProject}:environment:${environment}`,
    });
    return { ok: true, reason: "ok" };
  } catch (verifyError) {
    const name = verifyError instanceof Error ? verifyError.name : "unknown";
    const message =
      verifyError instanceof Error ? verifyError.message : String(verifyError);
    return { ok: false, reason: `verify-failed:${name}:${message}` };
  }
}

/**
 * Same check as isVerifiedPilotRuntimeRequest, but with the specific reason
 * a rejected request failed (never the token itself). Chat completions is
 * the entry point every runtime request other than a tool callback goes
 * through, so its 401 is what an operator actually sees when authentication
 * breaks; the reason is worth the extra response detail there.
 */
export async function verifyPilotRuntimeRequest(
  request: Request,
): Promise<{ ok: boolean; reason: string }> {
  const token = request.headers.get(tokenHeader);
  if (!token) return { ok: false, reason: "no-token-header" };

  const environment = deploymentEnvironment();
  if (!environment) {
    return {
      ok: false,
      reason: `bad-own-environment:${process.env.VERCEL_ENV ?? "unset"}`,
    };
  }

  return verifySignature(token, environment);
}
