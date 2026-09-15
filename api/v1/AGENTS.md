# AGENTS.md — Vercel Functions

See the root [`AGENTS.md`](../../AGENTS.md) first; this file only adds what is
specific to this directory.

## Contract

- Every file here is a thin Vercel Function wrapper: `export const config = {
runtime: "nodejs" }` plus `export default { fetch: <handler> }`, where
  `<handler>` is imported from `src/mastra/server/`. No auth check, parsing,
  or business logic lives in this directory — it all lives in the handler.
- `vercel.json` rewrites public `/v1/:path*` requests to `/api/v1/:path*`;
  keep the directory structure (`chat/completions.ts`,
  `conversations/delete.ts`, `conversations/truncate.ts`,
  `projects/delete-memory.ts`) matching the public route shape, and add a
  `functions` entry with an explicit `maxDuration` in `vercel.json` for any
  new long-running route.
- The corresponding Mastra custom API route (`src/mastra/server/routes/`) for
  the same operation must stay behaviorally identical to the file here —
  both are boundaries onto the same handler and must both verify the request
  the same way.

## Invariants

- A handler reached through this directory must verify the WorkOS M2M runtime
  token (`src/mastra/auth/workos-m2m.ts`) and reject non-POST/unauthenticated
  requests before parsing the body, initializing Mastra, or reading tenant
  headers.
- Never derive organization/conversation/execution identity from the request
  payload here or in the handler it wraps — only from the verified execution
  record.
