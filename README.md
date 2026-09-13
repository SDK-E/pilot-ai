# Pilot AI

The Mastra runtime behind [Pilot](https://github.com/SDK-E/pilot). Pilot owns
authentication, organization authorization, agents, conversations, execution
records, and approvals. This service owns agent construction, memory,
workflows, and the protected runtime API; it never makes authorization
decisions and never stores Pilot domain records.

## Project structure

The layout follows Mastra's standard `src/mastra` project structure. Every
agent is built by the base agent; the base agent owns everything reusable.

```
api/v1/                     Vercel Functions. Each file is a thin wrapper over a
                            handler in src/mastra/server.
src/contracts/              Pure request/response contract shared with Pilot.
                            Zero @mastra imports, zero process.env.
src/mastra/
  index.ts                  Mastra instance: storage, logger, routes, workflows.
  agents/
    base/                   The base agent: factory, shared instructions, limits,
                            config profiles, processors, and skill preflight.
      processors/           Input processors grouped by concern:
        context/ quality/ budget/ response/ policy/
    chat/                   Chat agent: identity and instructions only.
    runtime/                Request-scoped runtimes used by the server.
  server/                   HTTP layer: OpenAI-compatible translation, handlers,
                            and Mastra route registrations (routes/).
  tools/                    Mastra tools, discovered by the Mastra CLI. Grouped by
                            what they touch: web/ search/ files/ planning/ pilot/
                            browser/ code/ skills/.
  workflows/                Mastra workflows.
  scorers/                  Evaluation scorers.
  memory/ storage/ cache/   Memory factories, storage adapters, caches.
  activity/ auth/ security/ Pilot activity callback, Vercel OIDC verification,
                            public-URL guard.
  work/                     Durable Work cache (Redis).
  setup/                    Wires cache and network config into the tools.
  development/              The full-capability development agent, subagents,
                            long-form instructions, and memory. Registered only
                            when PILOT_ENABLE_DEVELOPMENT_TOOLS=true; never
                            imported by a deployed function.
src/evals/                  Opt-in live evaluations (pnpm eval:*).
scripts/                    Terminal scripts (pnpm verify:memory).
```

Relative imports carry an explicit `.js` extension because the Vercel
functions run unbundled on Node ESM. ESLint enforces this.

## Runtime API

The production runtime is `https://ai.pilot.sdk.enterprises`.
`POST /v1/chat/completions` accepts OpenAI Chat Completions `model`,
`messages`, and `stream`, and returns a `chat.completion` object or an SSE
stream. Pilot first checks the user's WorkOS session and tenant authorization,
then forwards a short-lived Vercel OIDC token. The runtime validates its
issuer, audience, and exact Pilot project and environment subject before it
reads the request body, initializes Mastra, or accepts the tenant headers.
This protects the custom domain even where Vercel Deployment Protection does
not apply to it. `vercel.json` rewrites `/v1/*` to the function entries.

The same boundary exposes `POST /v1/approvals/resume`,
`POST /v1/conversations/delete`, `POST /v1/projects/delete-memory`, and
`POST /v1/tasks/approval`. All require the verified Pilot OIDC token and accept
only typed server commands; the browser never calls them.

A request with granted capabilities runs on the tool runtime with `web-search`,
`scratchpad`, and `ask-user`. Capabilities are selected only from Pilot's
server-generated command; per-tool approval requirements travel separately, so
an `ask` policy for one capability never pauses an allowed one. `ask_user` is a
clarification suspension, not an approval. The scratchpad callback derives the
conversation and creator from its active execution record, so the runtime
never supplies ownership.

## Configuration

Preview and Production require `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for
the matching environment. Local development without that pair uses
`src/.mastra/pilot-runtime.db`; it is a local-only fallback.

`PILOT_LOG_LEVEL` sets the shared logger level (`debug`, `info`, `warn`,
`error`, `silent`).

Public web search requires `PILOT_ENABLE_RESEARCH=true` and
`PILOT_ACTIVITY_CALLBACK_URL`. Skill discovery is separately opt-in through
`PILOT_ENABLE_RUNTIME_SKILLS=true` and runs per request only when the verified
Pilot OIDC token and activity callback are available; only a validated
selected-skill label reaches Pilot activity records.

Pilot Work durability is fail-closed: a shared Redis endpoint in
`PILOT_WORK_REDIS_URL` is required before a Work run can claim reconnectable
observation across Vercel instances (`rediss://` for managed TLS).
`PILOT_WORK_CACHE_TTL_SECONDS` defaults to one hour (minimum 60).

All model-controlled public URL fetches are protected by a DNS and redirect
boundary that rejects loopback, private, link-local, local-name, mixed DNS,
and credential-bearing targets before any network request.

## Development

Use Node.js 24 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm check        # lint, typecheck, prettier, knip
pnpm test         # deterministic unit tests
pnpm build        # mastra build
pnpm dev          # Mastra playground
pnpm dev:full     # playground with the development tool set registered
```

`pnpm dev:full` and `pnpm build:full` set `PILOT_ENABLE_DEVELOPMENT_TOOLS=true`
and register the development agent, subagents, workflows, and scorers. That
registration requires `MASTRA_DATABASE_URL`, `MASTRA_EDITOR_DATABASE_URL`, and
`MASTRA_MEMORY_DATABASE_URL` pointing outside `src/` so local data is never
deployed. The `pnpm eval:*` commands run live Kilo and browser evaluations and
are deliberately opt-in.

`pnpm verify:memory` is an opt-in live persistence check that performs two
Kilo Gateway generations across two processes and deletes its randomized
Mastra thread afterward.

Before adding Mastra code, read the installed package documentation. Every
agent is constructed through the base agent, including the shared prompt
enhancer; agent-specific processors run after that shared context. Never add a
file-backed database to the deployed runtime path or expose a tool before Pilot
enforces its capability and approval policy.

GitHub Actions builds the runtime and checks known high-severity
vulnerabilities for pull requests and `main`.
