# AGENTS.md — Runtime Auth

## Purpose

Runtime authentication and authorization between Pilot and Mastra.

## Key files

- `src/runtime/auth/vercel-oidc.ts` — Vercel OIDC token verification (JWKS, issuer, audience, subject pinning)

## Rules

- Accept only short-lived Vercel OIDC tokens issued to the Pilot deployment.
- Verify issuer (team or global), audience, subject (`owner:teamSlug:project:sourceProject:environment`), and signature via JWKS.
- Deployment environment (`VERCEL_ENV`) must be set; requests without token or environment are rejected.
- No runtime route may bypass this verification.
