import { createRemoteJWKSet, jwtVerify } from "jose";

const tokenHeader = "x-pilot-runtime-token";

function expectedIssuer(): string | undefined {
  return process.env.WORKOS_M2M_AUTHKIT_DOMAIN?.trim();
}

function expectedClientId(): string | undefined {
  return process.env.WORKOS_M2M_CLIENT_ID?.trim();
}

/**
 * Accept only a token WorkOS issued to Pilot's own M2M application: valid
 * signature via that AuthKit environment's JWKS, and `sub` equal to Pilot's
 * client ID. `aud` identifies WorkOS's own per-environment AuthKit app, not
 * either side of this boundary, so it is not checked.
 */
export async function verifyPilotRuntimeRequest(
  request: Request,
): Promise<{ ok: boolean; reason: string }> {
  const token = request.headers.get(tokenHeader);
  if (!token) return { ok: false, reason: "no-token-header" };

  const issuer = expectedIssuer();
  const clientId = expectedClientId();
  if (!issuer || !clientId) return { ok: false, reason: "not-configured" };

  try {
    const { payload } = await jwtVerify(
      token,
      createRemoteJWKSet(new URL(`${issuer}/oauth2/jwks`)),
      { issuer },
    );
    if (payload.sub !== clientId) return { ok: false, reason: "wrong-subject" };
    return { ok: true, reason: "ok" };
  } catch (verifyError) {
    const name = verifyError instanceof Error ? verifyError.name : "unknown";
    const message =
      verifyError instanceof Error ? verifyError.message : String(verifyError);
    return { ok: false, reason: `verify-failed:${name}:${message}` };
  }
}

export async function isVerifiedPilotRuntimeRequest(
  request: Request,
): Promise<boolean> {
  const result = await verifyPilotRuntimeRequest(request);
  return result.ok;
}
