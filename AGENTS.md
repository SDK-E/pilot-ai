# AGENTS.md

## Verify current Mastra APIs first

Before any Mastra work, read the current official documentation at
https://mastra.ai/llms.txt and inspect the installed package types. APIs change
between versions; never rely on cached knowledge.

## Rules

- Every agent is built per request from the base agent
  (`src/mastra/agents/base/agent.ts`) and one kind in `src/mastra/agents/kinds.ts`.
  A kind holds only what differs: identity, instructions, allowed capabilities,
  step limits. Anything reusable (processors, tools, caches, config) belongs
  under `src/mastra/agents/base/` or the shared `src/mastra/*` folders, never
  under a kind.
- No agent is registered on the Mastra instance; `src/mastra/index.ts` only
  wires storage, the durable-work cache, workflows, and the API routes.
- Use the `dev` and `build` scripts from `package.json` instead of running
  `mastra dev` / `mastra build` directly.
- A deployed runtime route must validate Pilot's short-lived WorkOS M2M token
  (`x-pilot-runtime-token`, verified in `src/mastra/auth/workos-m2m.ts`)
  before parsing tenant headers or initializing Mastra. WorkOS session and
  organization authorization stay in the Pilot application; Pilot AI never
  creates or accepts a separate user session, and never holds Pilot's M2M
  client secret.
- Any tool that fetches a model-controlled URL must pass the initial URL and
  every redirect through `assertPublicHttpUrl` (`src/mastra/security/public-url.ts`).
  Reject loopback, private, link-local, mixed DNS answers, local hostnames, and
  credential-bearing URLs; a read-only tool is not safe without this check.
- Capabilities (`web-search`, `scratchpad`, `ask-user`) are the only way a tool
  reaches an agent, and only when Pilot's server-generated command grants them.
  The activity callback uses the original verified Pilot runtime token, targets the
  fixed `PILOT_ACTIVITY_CALLBACK_URL`, and sends only capability id, lifecycle
  state, organization id, and execution id. Never send prompts, tool inputs,
  outputs, URLs, errors, or reasoning through that callback.
- The scratchpad callback derives organization, conversation, worker, and
  creator from the active execution record, never from model-controlled input.
  `ask_user` uses Mastra's persisted tool suspension and automatic resume; its
  question and choices return only through the authenticated runtime response.
  Approval requirements stay scoped to the approvable capabilities; `ask_user`
  is a clarification suspension and never requires approval. Unknown or
  unavailable tools fail closed.
- Durable Pilot Work requires both the environment-specific Postgres store and
  a shared Redis cache. Never fall back to an in-memory cache for a run
  advertised as reconnectable: a process restart would lose its event
  history. Keep `PILOT_WORK_REDIS_URL` server-only.
- Relative imports carry an explicit `.js` extension (functions run unbundled on
  Node ESM). `pnpm check` (lint, typecheck, prettier, knip) and `pnpm test` must
  be clean before a commit.

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
