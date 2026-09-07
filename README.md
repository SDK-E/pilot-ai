# Pilot AI

The runtime boundary for [Pilot](https://github.com/SDK-E/pilot) and Pilot Research.

Pilot Research is an experimental agent in the same runtime service. It remains
unavailable to Pilot users: it has no tenant-scoped service adapter, no Pilot
authorization context, and no approved deployment path. Do not treat a Mastra
agent registered for local development as a Pilot Worker capability.

Pilot owns authentication, organization authorization, workers, conversations,
execution records, and approvals. Mastra supplies agent, memory, workflow, and
durable-execution capabilities; it does not own Pilot domain records or make
authorization decisions.

`src/index.ts` is the Mastra service entrypoint. It holds the Pilot route and
conditionally registers both agents for local Mastra development. The Vercel
function at `api/v1/chat/completions.ts` is the production adapter: it imports
only the tenant-scoped Conversation runtime and has no Research import.
`src/runtime/agent/base-agent.ts` is the
shared BaseAgent factory: every agent receives the same input normalization,
current-context, objective-continuity, response-quality, failure-recovery,
token-limit, step-budget, and bounded API-retry pipeline. Agent-specific code
lives in `src/conversation` and `src/research`; shared and research-capability
runtime components live in `src/runtime`. Browser, local LibSQL, DuckDB,
embeddings, evals, editor, observability, and Stagehand remain development
dependencies of Pilot Research.

The `pilot` adapter is the beginning of the product runtime. It
accepts only a server-generated, validated command; maps the organization and
Worker to an immutable Mastra memory resource; maps the Pilot Conversation UUID
to the Mastra thread; and uses `@mastra/libsql` with the matching Turso database.
It allows only the Kilo Gateway development model `kilo/kilo-auto/free` and
has no enabled tools. Tool access will be added as a narrow, request-scoped
capability after Pilot enforces its capability and approval policy. It must use
Mastra's restart-safe `ToolSearchProcessor` context storage and capability
filter, never browser-provided tool identifiers.

The runtime requires `PILOT_MASTRA_DATABASE_URL` and `TURSO_AUTH_TOKEN` for
the matching environment. `pnpm verify:memory` performs a real two-process
memory check and deletes its randomized thread afterward.

On 2026-09-07, Preview was deployed through a remote Linux Vercel build and
verified through its protected endpoint. Two separate function invocations
wrote and then recalled a randomized conversation value through Turso.
Production is now also deployed with its own sensitive `TURSO_AUTH_TOKEN`.

## Runtime API

The production runtime is `https://ai.pilot.sdk.enterprises`.
`POST /v1/chat/completions` accepts OpenAI Chat Completions `model`,
`messages`, and `stream: false`, then returns a `chat.completion` object with
`choices` and token `usage`. Pilot first checks the user's WorkOS session and
tenant authorization, then forwards a short-lived Vercel OIDC token. The
runtime validates its issuer, audience, and exact Pilot project and environment
subject before it reads the request body, initializes Mastra, or accepts the
tenant headers. This protects the custom domain even where Vercel Deployment
Protection does not apply to it. `vercel.json` deploys only this isolated Node
function and rewrites `/v1/*` to its Vercel Function entry. Mastra's generic
agent routes remain private because they would expose development-only Research
capabilities.

## Development

Use Node.js 24 and pnpm. The `dev` and `build` scripts invoke the Mastra CLI.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm knip
pnpm build
```

`pnpm test` runs deterministic unit tests. The `pnpm eval:*` commands run live
Kilo/browser evaluation work and are deliberately opt-in.

`pnpm verify:memory` is an opt-in live persistence check. Set
`PILOT_MASTRA_DATABASE_URL` and `TURSO_AUTH_TOKEN` for an isolated,
matching-environment Turso database; it performs two Kilo Gateway generations
and deletes its randomized Mastra thread.

The Research Agent is local-development only. If enabled, it requires explicit
`MASTRA_DATABASE_URL`, `MASTRA_EDITOR_DATABASE_URL`, and
All model-controlled public URL fetches are protected by a DNS and redirect
boundary. The runtime rejects loopback, private, link-local, local-name, mixed
DNS, and credential-bearing targets before issuing a network request.

`MASTRA_MEMORY_DATABASE_URL` values that point outside `src/`; this prevents
local research data from being copied into a deployment.

`pnpm dev` and `pnpm build` run the normal Pilot configuration. `pnpm
dev:research` and `pnpm build:research` set `PILOT_ENABLE_RESEARCH=true` and
register Pilot Research through the same entrypoint. Research is not activated
for a normal runtime request. Mastra's build still follows the optional
registration import and packages research dependencies, so it is a local
development artifact. Vercel deploys only the isolated OpenAI-compatible
Conversation function.

Before adding Mastra code, read [AGENTS.md](AGENTS.md) and the current package
documentation. Production runtime storage uses the environment-specific Turso
LibSQL database through `PILOT_MASTRA_DATABASE_URL`; never add a file-backed
database to the Pilot Conversation path or expose a tool before Pilot enforces
its capability and approval policy.

GitHub Actions builds the runtime and checks known high-severity vulnerabilities for pull requests and `main`.
