import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

const teamSlug = 'sdk-enterprises';
const teamIssuer = `https://oidc.vercel.com/${teamSlug}`;
const globalIssuer = 'https://oidc.vercel.com';
const audience = `https://vercel.com/${teamSlug}`;
const sourceProject = 'pilot';
const tokenHeader = 'x-pilot-runtime-oidc-token';

const verificationKeysByIssuer = new Map([
  [
    teamIssuer,
    createRemoteJWKSet(new URL(`${teamIssuer}/.well-known/jwks`)),
  ],
  [
    globalIssuer,
    createRemoteJWKSet(new URL(`${globalIssuer}/.well-known/jwks`)),
  ],
]);

function deploymentEnvironment(): 'preview' | 'production' | undefined {
  const environment = process.env.VERCEL_ENV;
  return environment === 'preview' || environment === 'production'
    ? environment
    : undefined;
}

/**
 * Accept only a short-lived Vercel OIDC token issued to the Pilot deployment
 * in the matching Vercel environment. Pilot forwards this token after its
 * WorkOS session and tenant authorization checks have completed.
 */
export async function verifyPilotRuntimeRequest(request: Request): Promise<boolean> {
  const token = request.headers.get(tokenHeader);
  const environment = deploymentEnvironment();

  if (!token || !environment) {
    return false;
  }

  try {
    // Decoding selects one of two fixed Vercel issuers only. jwtVerify below
    // verifies the signature and pins that issuer before accepting the token.
    const decoded = decodeJwt(token);
    const issuer = typeof decoded.iss === 'string' ? decoded.iss : undefined;
    const verificationKeys = issuer
      ? verificationKeysByIssuer.get(issuer)
      : undefined;

    if (!issuer || !verificationKeys) {
      return false;
    }

    await jwtVerify(token, verificationKeys, {
      issuer,
      audience,
      subject: `owner:${teamSlug}:project:${sourceProject}:environment:${environment}`,
    });
    return true;
  } catch {
    return false;
  }
}
