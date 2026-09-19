# AGENTS.md — Tools

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- Tools are grouped by what they touch: `web/` (public URL fetch/discovery,
  guarded by `assertPublicHttpUrl`), `search/` (web search + dorking),
  `code/` (`sandbox-run.ts` for the code sandbox, `github-public.ts`),
  `pilot/` (`scratchpad.ts`, `plan.ts` — tools that call back into Pilot).
- A tool file only defines the Mastra tool (`createTool`) and its execution.
  It is never registered directly on an agent; `src/mastra/agents/base/capabilities/`
  is the only place that maps a capability id to a set of tools.
- Every tool that fetches a model-controlled URL — the initial URL and every
  redirect — must pass through `assertPublicHttpUrl`
  (`src/mastra/security/public-url.ts`). This is what makes `url-fetch.ts`,
  `bulk-url-fetch.ts`, `site-discovery.ts`, and `domain-intelligence.ts` safe
  to expose to a model; do not add a new URL-fetching tool without it.
- `pilot/scratchpad.ts` and `pilot/plan.ts` call Pilot's own callback URL
  (`activity/callback-url.ts`) with the verified runtime token
  (`x-pilot-runtime-token`); they derive organization/execution identity from
  the already-validated `GenerateConversationReply` command passed in at
  construction time, never from model output.
- `code/sandbox-run.ts` runs in a fresh E2B sandbox per call with no access
  to this service's secrets or storage. Authenticates via `E2B_API_KEY`.

## Invariants

- Tool output schemas are Zod-validated (`.strict()` where the shape is
  closed) — a tool must not return unvalidated network response bodies to
  the model.
- Unknown or unavailable tools fail closed — never fall back to a permissive
  default when a capability lookup misses.
