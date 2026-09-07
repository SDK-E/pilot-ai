import { createRemoteJWKSet, jwtVerify } from 'jose';

const teamSlug = 'sdk-enterprises';
const issuer = `https://oidc.vercel.com/${teamSlug}`;
const audience = `https://vercel.com/${teamSlug}`;
const sourceProject = 'pilot';
const tokenHeader = 'x-vercel-trusted-oidc-idp-token';

const verificationKeys = createRemoteJWKSet(
  new URL(`${issuer}/.well-known/jwks`),
);

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
