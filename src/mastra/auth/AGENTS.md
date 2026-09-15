# AGENTS.md — Runtime Auth

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Purpose

Runtime authentication between Pilot and Mastra: proving a request genuinely
came from Pilot's server, not authorizing what it may do (that stays in
Pilot).

## Key files

- `workos-m2m.ts` — WorkOS M2M token verification
  (`verifyPilotRuntimeRequest`, `isVerifiedPilotRuntimeRequest`): JWKS lookup
  against the configured AuthKit domain, issuer check, and exact `sub`
  (Pilot's WorkOS M2M client id) pinning.
- `workos-m2m.test.ts` — the reference cases for accepted/rejected tokens.

## Rules

- Accept only a short-lived WorkOS M2M token (`client_credentials` grant)
  that Pilot mints for its own M2M application, sent in the
  `x-pilot-runtime-token` header. This replaced an earlier Vercel OIDC-token
  design; do not reintroduce OIDC verification here — the WorkOS M2M check
  works identically in local development because it isn't tied to running on
  Vercel.
- Verify signature via `${WORKOS_M2M_AUTHKIT_DOMAIN}/oauth2/jwks`, the `iss`
  claim, and require `sub` to equal `WORKOS_M2M_CLIENT_ID` exactly. `aud`
  identifies WorkOS's own AuthKit app, not either side of this boundary, and
  is intentionally not checked.
- Both `WORKOS_M2M_AUTHKIT_DOMAIN` and `WORKOS_M2M_CLIENT_ID` must be
  configured; a request is rejected outright when either is missing.
- No runtime route may bypass this verification, and it must run before the
  request body is parsed, Mastra is initialized, or tenant headers are read.
