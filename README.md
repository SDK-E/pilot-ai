# Pilot AI

The runtime boundary for [Pilot](https://github.com/SDK-E/pilot) and Pilot Research.

Pilot Research has two deliberately separate forms: a broad agent for local
development and an isolated, tenant-scoped production adapter. The broad agent
is never a Pilot Worker capability. The production adapter is gated and has a
small, reviewed capability boundary.

Pilot owns authentication, organization authorization, workers, conversations,
execution records, and approvals. Mastra supplies agent, memory, workflow, and
durable-execution capabilities; it does not own Pilot domain records or make
authorization decisions.

The production Research adapter is separate from the broad local-development
agent. When enabled, it receives only the hardened `web-search` tool and uses
the original verified Pilot OIDC token to append sanitized tool lifecycle
events through `PILOT_ACTIVITY_CALLBACK_URL`. It does not import Stagehand,
browser actions, MCP, files, exports, scratchpad writes, or delegation.

`src/index.ts` is the Mastra service entrypoint. It holds the Pilot route and
conditionally registers both agents for local Mastra development. The Vercel
function at `api/v1/chat/completions.ts` is the production adapter: it imports
the tenant-scoped Conversation runtime and, only when explicitly enabled, the
isolated Research runtime.
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
Conversation has no tools. Production Research accepts only a server-generated
`web-search` capability and must not rely on browser-provided tool identifiers.

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
function and rewrites `/v1/*` to its Vercel Function entry. Generic Mastra
runtime routes verify the same OIDC token before they parse a request or create
storage, so they cannot expose local-development capabilities.

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

The broad Research Agent is local-development only. It requires explicit
`MASTRA_DATABASE_URL`, `MASTRA_EDITOR_DATABASE_URL`, and
`MASTRA_MEMORY_DATABASE_URL` values that point outside `src/`; this prevents
local research data from being copied into a deployment. The production adapter
requires `PILOT_ENABLE_RESEARCH=true`, `PILOT_ACTIVITY_CALLBACK_URL`, and the
same matching-environment Turso configuration as Conversation.

All model-controlled public URL fetches are protected by a DNS and redirect
boundary. The runtime rejects loopback, private, link-local, local-name, mixed
DNS, and credential-bearing targets before issuing a network request.

`pnpm dev` and `pnpm build` run the normal Pilot configuration. `pnpm
dev:research` and `pnpm build:research` set
`PILOT_ENABLE_DEVELOPMENT_RESEARCH=true` and
register Pilot Research through the same entrypoint. Research is not activated
for a normal runtime request. Mastra's build still follows the optional
registration import and packages research dependencies, so it is a local
development artifact. Vercel deploys the isolated OpenAI-compatible runtime;
Research remains unavailable there until its production feature flag is set.

Before adding Mastra code, read [AGENTS.md](AGENTS.md) and the current package
documentation. Every Pilot agent is constructed through the shared BaseAgent
pipeline, including the generic short-request prompt enhancer; agent-specific
research policy and verification processors run after that shared context.
Production runtime storage uses the environment-specific Turso
LibSQL database through `PILOT_MASTRA_DATABASE_URL`; never add a file-backed
database to the Pilot Conversation path or expose a tool before Pilot enforces
its capability and approval policy.

GitHub Actions builds the runtime and checks known high-severity vulnerabilities for pull requests and `main`.
