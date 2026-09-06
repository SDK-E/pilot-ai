# Pilot AI

Mastra runtime and intelligence boundary for [Pilot](https://github.com/SDK-E/pilot).

`pilot-research` is an experimental research runtime developed independently of
the Pilot product. It remains unavailable to Pilot users: it has no
tenant-scoped service adapter, no Pilot authorization context, and no approved
deployment path. Do not treat a Mastra agent registered for local development
as a Pilot Worker capability.

Pilot owns authentication, organization authorization, workers, conversations,
execution records, and approvals. Mastra supplies agent, memory, workflow, and
durable-execution capabilities; it does not own Pilot domain records or make
authorization decisions.

The Conversation source path depends only on the Mastra server, core, memory,
PostgreSQL storage, and Zod. Browser, local LibSQL, DuckDB, embeddings, evals,
editor, observability, and Stagehand remain development dependencies of the
Research Agent.

The `pilot-conversation` adapter is the beginning of the product runtime. It
accepts only a server-generated, validated command; maps the organization and
Worker to an immutable Mastra memory resource; maps the Pilot Conversation UUID
to the Mastra thread; and uses `@mastra/pg` with the matching Neon database.
It allows only the Kilo Gateway development model `kilo/kilo-auto/free` and
has no tools. Its only endpoint is `POST /pilot/conversations/generate`, which
is disabled unless `PILOT_MASTRA_DATABASE_URL` is configured. Deploy it only
behind Vercel Deployment Protection with Pilot configured as a Trusted Source;
it relies on that server-to-server boundary and must never be attached to a
public custom domain. Tool access will be added as a narrow, request-scoped
capability after Pilot enforces its capability and approval policy.

On 2026-09-06, `pnpm verify:memory` proved the development path with the
matching Neon database and Kilo Gateway: a first runtime wrote a message, a
separate runtime process recalled it, and the verifier deleted its randomized
thread afterward. The production and preview runtime environments still need
their own `PILOT_MASTRA_DATABASE_URL` configuration before this adapter can be
deployed.

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
`PILOT_MASTRA_DATABASE_URL` to an isolated, matching-environment Neon URL; it
performs two Kilo Gateway generations and deletes its randomized Mastra thread.

The Research Agent is local-development only. If enabled, it requires explicit
`MASTRA_DATABASE_URL`, `MASTRA_EDITOR_DATABASE_URL`, and
`MASTRA_MEMORY_DATABASE_URL` values that point outside `src/`; this prevents
local research data from being copied into a deployment.

The two runtime entrypoints are intentionally separate: `pnpm dev` and
`pnpm build` target Pilot Conversation; `pnpm dev:research` and
`pnpm build:research` target the local Research Agent. This keeps browser and
research dependencies outside the deployable Conversation artifact.

Before adding Mastra code, read [AGENTS.md](AGENTS.md) and the current package
documentation. Production runtime storage uses the environment-specific Neon
PostgreSQL database through `PILOT_MASTRA_DATABASE_URL`; never add a file-backed
database to the Pilot Conversation path or expose a tool before Pilot enforces
its capability and approval policy.

GitHub Actions builds the runtime and checks known high-severity vulnerabilities for pull requests and `main`.
