# Development

Local setup, project structure, the runtime HTTP contract, and configuration
for Pilot AI. See [README.md](../README.md) for what this service is and what
it does.

## Project structure

The layout follows Mastra's standard `src/mastra` project structure. Inside
`src/mastra/agents/`, Mastra's CLI treats any folder containing `config.ts`,
`instructions.*`, `memory.ts`, `workspace.ts`, or a `tools/`, `skills/`,
`subagents/`, `workflows/`, `scorers/`, or `processors/` folder as a
file-based agent, so shared modules deliberately use other names.

```
api/v1/                     Vercel Functions. Each file is a thin wrapper over a
                            handler in src/mastra/server.
src/contracts/              Pure request/response contract shared with Pilot.
                            Zero @mastra imports, zero process.env.
src/mastra/
  index.ts                  Mastra instance: storage, logger, routes, workflow.
  agents/
    kinds.ts                The three kinds and what differs between them.
    chat.ts work.ts code.ts Identity and instructions of one kind each.
    base/                   The base agent everything is built from:
      agent.ts              factory with the shared processor pipeline
      shared-instructions.ts, identity.ts, limits.ts
      capabilities/         capability id -> tools, instructions, approvability
      pipeline/             input processors by concern:
                            context/ quality/ budget/ response/ policy/
                            reminders.ts (factories), evidence.ts (the set
                            attached with web-search)
      profiles/             tuning profiles (fast, balanced, deep, test)
      skill-preflight.ts    audited skill discovery
    runtime/                Request-scoped runtime: agent factory, results,
                            suspensions, generate/stream/resume/cleanup.
  server/                   HTTP layer: OpenAI-compatible translation, handlers,
                            and Mastra route registrations (routes/).
  tools/                    Mastra tools by what they touch:
                            web/ search/ code/ pilot/ connectors/.
  workflows/                The task-approval workflow.
  memory/ storage/ cache/   Memory factories, storage adapter, tool cache.
  activity/ auth/ security/ Pilot activity callback, WorkOS M2M verification,
                            public-URL guard.
  work/                     Durable Work cache (Redis).
  setup/                    Wires cache and network config into the web tools.
scripts/                    Terminal scripts (pnpm verify:memory).
```

Relative imports carry an explicit `.js` extension because the Vercel
functions run unbundled on Node ESM. ESLint enforces this.

## Runtime API

The production runtime is `https://ai.pilot.sdk.enterprises`.
`POST /v1/chat/completions` accepts OpenAI Chat Completions `model`,
`messages`, and `stream`, and returns a `chat.completion` object or an SSE
stream. Pilot first checks the user's WorkOS session and tenant authorization,
then forwards a short-lived WorkOS M2M token minted for its own Connect
application (`client_credentials` grant). The runtime validates its signature
against that AuthKit environment's JWKS and its exact subject (Pilot's M2M
client ID) before it reads the request body, initializes Mastra, or accepts
the tenant headers. This protects the custom domain even where Vercel
Deployment Protection does not apply to it, and — unlike the Vercel OIDC token
it replaced — works identically in local development, since it isn't tied to
running on Vercel at all. `vercel.json` rewrites `/v1/*` to the function
entries.

The same boundary exposes `POST /v1/approvals/resume`,
`POST /v1/conversations/delete`, `POST /v1/projects/delete-memory`, and
`POST /v1/tasks/approval`. All require the verified Pilot runtime token and
accept only typed server commands; the browser never calls them.

Capabilities are selected only from Pilot's server-generated command; per-tool
approval requirements travel separately, so an `ask` policy for one capability
never pauses an allowed one. `ask_user` is a clarification suspension, not an
approval. The scratchpad callback derives the conversation and creator from
its active execution record, so the runtime never supplies ownership.

## Configuration

Preview and Production require `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for
the matching environment. Local development without that pair uses
`src/.mastra/pilot-runtime.db`; it is a local-only fallback.

`PILOT_LOG_LEVEL` sets the shared logger level (`debug`, `info`, `warn`,
`error`, `silent`).

Public web search requires `PILOT_ENABLE_WEB_SEARCH=true`,
`LANGSEARCH_API_KEY`, and `PILOT_ACTIVITY_CALLBACK_URL`. Skill discovery runs
per request whenever the verified Pilot runtime token and activity callback
are available; only a validated selected-skill label reaches Pilot activity
records.

The 8 connector tools (GitHub, Google Drive, Gmail, Slack, Notion, Linear,
Vercel, Monday.com) require `PILOT_ENABLE_CONNECTORS=true`, the platform
circuit breaker for all of them regardless of provider. It is independent of
Pilot's own per-org/per-user connection state for each provider.

`PILOT_PROFILE` (`fast`, `balanced`, `deep`, `test`) picks the cache, timeout,
and evidence-reminder cadence for the web tools; the `PILOT_*_MS` values in
`.env.example` override single numbers.

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
```

`pnpm verify:memory` is an opt-in live persistence check that performs two
Kilo Gateway generations across two processes and deletes its randomized
Mastra thread afterward.

Before adding Mastra code, read the installed package documentation. Every
agent is constructed through the base agent, including the shared prompt
enhancer; kind-specific instructions and granted capabilities are layered on
top. Never add a file-backed database to the deployed runtime path or expose a
tool before Pilot enforces its capability and approval policy.

GitHub Actions builds the runtime and checks known high-severity
vulnerabilities for pull requests and `main`.
