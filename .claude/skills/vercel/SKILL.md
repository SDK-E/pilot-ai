---
name: vercel
description: "This repo's Vercel Functions setup: api/v1/* entry points, vercel.json rewrites, and @vercel/sandbox for the code-sandbox tool. Use when adding or changing a runtime HTTP entry point or the sandboxed code tool."
---

# Vercel setup (pilot-ai)

## Functions layout

`api/v1/*.ts` files are thin Vercel Function wrappers — each just imports a
handler from `src/mastra/server/` and re-exports it:

```ts
// api/v1/chat/completions.ts
import { handleChatCompletion } from "../../../src/mastra/server/chat-completions.js";

export const config = { runtime: "nodejs" };

export default { fetch: handleChatCompletion };
```

Current entry points: `api/v1/chat/completions.ts`,
`api/v1/conversations/delete.ts`, `api/v1/conversations/truncate.ts`,
`api/v1/projects/delete-memory.ts`. All real request/auth/business logic lives
in `src/mastra/server/`, never in the `api/v1/*` file itself — see
`api/v1/AGENTS.md`.

## `vercel.json`

- `buildCommand: pnpm typecheck` — Vercel's own build step is just the
  typecheck; `mastra build` happens separately.
- `outputDirectory: public` (a placeholder static dir; this is an API-only
  deployment).
- `rewrites`: `/v1/:path*` → `/api/v1/:path*`, so the public runtime API is
  served at `/v1/...` while the function files live under `api/v1/...`.
- `functions`: per-route `maxDuration` overrides (`chat/completions.ts`: 90s,
  `conversations/delete.ts`: 30s). Add an entry here for any new long-running
  route rather than relying on the platform default.

The production runtime is `https://ai.pilot.sdk.enterprises`, a custom domain
— Vercel Deployment Protection does not necessarily apply to it, which is why
the WorkOS M2M check (see the `workos` skill) is the real boundary, not
Vercel's own auth.

## `@vercel/sandbox` (code-sandbox tool)

`src/mastra/tools/code/sandbox-run.ts` is the code-sandbox tool implementation
backing the `code-sandbox` capability (`src/contracts/conversation.ts`). Each
call runs in a **fresh** Vercel Sandbox with no access to Pilot's systems,
secrets, or data — never reuse a sandbox across calls or executions, and never
pass runtime secrets (Turso, Redis, WorkOS, activity callback token) into the
sandboxed process's environment.

The tool is gated twice: the org-level `codeSandboxEnabled` preference (set in
Pilot, not this repo) and pilot-ai's own `codeSandboxEnabled` Edge Config flag
(`src/mastra/server/feature-flags.ts`, backed by `EDGE_CONFIG`) as a platform
circuit breaker — both must allow it.

## Local development

`api/v1/*` functions are not exercised by `pnpm dev` (that runs the Mastra
playground on port 4111). To smoke-test a Vercel Function locally you need the
Vercel CLI (`vercel dev`) or a deployed preview; see the `agent-browser` skill
for driving those endpoints with browser automation once deployed.
