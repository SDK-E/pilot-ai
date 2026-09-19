---
name: workos
description: "WorkOS M2M authentication rules for the pilot-ai runtime boundary. Use before touching src/mastra/auth/, any /v1/* runtime route, or any /api/runtime/* callback."
---

# WorkOS M2M auth (pilot-ai)

pilot-ai is **not** a WorkOS session participant. Pilot (the frontend) owns the
user's WorkOS session and organization authorization entirely. pilot-ai only
verifies that a request genuinely came from Pilot's server.

## The mechanism (`src/mastra/auth/workos-m2m.ts`)

- Pilot mints a short-lived token via WorkOS's `client_credentials` grant for
  its own M2M application, and sends it on every runtime request in the
  `x-pilot-runtime-token` header.
- pilot-ai verifies it with `jose`'s `jwtVerify` against
  `${WORKOS_M2M_AUTHKIT_DOMAIN}/oauth2/jwks`, checking the `iss` claim, and
  requires `sub` to equal `WORKOS_M2M_CLIENT_ID` exactly (Pilot's client ID).
  `aud` identifies WorkOS's own AuthKit app, not either side of this boundary,
  so it is intentionally not checked.
- Both env vars are non-secret configuration (pilot-ai never holds a WorkOS
  client secret — only Pilot, the caller, does).
- `isVerifiedPilotRuntimeRequest(request)` is the boolean convenience wrapper;
  `verifyPilotRuntimeRequest(request)` returns `{ ok, reason }` for logging.

This **replaced** an earlier Vercel OIDC-token design. It works identically in
local development because it isn't tied to running on Vercel at all — do not
reintroduce OIDC verification here.

## Non-negotiable rules

- Every `/v1/*` runtime route (`src/mastra/server/routes/`) must call the
  verifier and reject a non-POST or unauthenticated request **before**
  parsing the request body, initializing Mastra, or reading tenant headers.
- Derive organization, conversation, execution, and creator identity from the
  **verified execution record**, never from the request payload. A model or a
  forged client can supply any JSON; only the token-authenticated call context
  is trustworthy.
- The activity callback and the scratchpad callback both re-derive ownership
  server-side from the active execution — see `src/mastra/activity/AGENTS.md`.
- Never send prompts, tool inputs/outputs, URLs, errors, or model reasoning
  through the token-authenticated callback to Pilot; only typed, bounded
  fields (capability id, lifecycle state, ids, a formatted `detail`).
- `.env.example` documents `WORKOS_M2M_AUTHKIT_DOMAIN` and
  `WORKOS_M2M_CLIENT_ID` — keep any new runtime route's auth check pointed at
  these, not at ad hoc env vars.

## Testing

`src/mastra/auth/workos-m2m.test.ts` is the reference for what "verified" and
"rejected" look like — extend it, don't bypass it, when adding a new callback
or route that needs this check.
