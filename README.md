# Pilot AI

The Mastra runtime behind [Pilot](https://github.com/SDK-E/pilot). Pilot owns
authentication, organization authorization, agents, conversations, execution
records, and approvals. This service owns agent construction, memory, the
task-approval workflow, and the protected runtime API; it never makes
authorization decisions and never stores Pilot domain records.

## Agent kinds

Every request builds one agent from the **base agent** and one of three kinds.
A kind is only what differs: identity, instructions, the capabilities it may
use, and step limits. Everything reusable belongs to the base agent.

| Kind   | Purpose                                                         |
| ------ | --------------------------------------------------------------- |
| `chat` | Conversational answers; uses granted capabilities when needed.  |
| `work` | Executes one queued work item: plan, act, request approvals.    |
| `code` | Reads, explains, and proposes code changes as reviewable diffs. |

Pilot sends the kind as `baseAgentId` together with the capabilities it grants
and which of those need an approval. The legacy ids `conversational` and
`research` are accepted and mapped to `chat` until Pilot migrates.

### Capabilities

| Capability   | Tools registered on the agent                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `web-search` | `webSearch`, `urlFetch`, `bulkUrlFetch`, `siteDiscovery`, `domainIntelligence`, `githubPublic` |
| `scratchpad` | `scratchpad` (private per-chat working state through the Pilot callback)                       |
| `ask-user`   | `ask_user` (Mastra clarification suspension)                                                   |

When `web-search` is granted the base agent also attaches the evidence
processors (source confidence, recency, contradiction, diversity, entity
resolution, memory hygiene) so long tool-using runs stay honest about their
sources. A plain chat turn pays nothing for them.

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
                            web/ search/ code/ pilot/.
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
