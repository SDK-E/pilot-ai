# Development

## Requirements

Node.js 24 and pnpm (see `packageManager` in `package.json`).

## Environment variables

Copy `.env.example` to `.env` and fill in what your task needs.

| Variable                                                | Required in                                   | Purpose                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                          | Always                                        | Mastra-owned runtime storage (Postgres/Neon). Use a separate database per environment; never point this at Pilot's own application database. `neon link` in this directory populates it.                                                                                                     |
| `PILOT_LOG_LEVEL`                                       | Optional                                      | Shared logger level: `debug`, `info`, `warn`, `error`, `silent`.                                                                                                                                                                                                                             |
| `WORKOS_M2M_AUTHKIT_DOMAIN`, `WORKOS_M2M_CLIENT_ID`     | Always for a real runtime call                | The WorkOS M2M application Pilot authenticates with (`client_credentials` grant). Verified against this AuthKit environment's JWKS; not secret — pilot-ai never holds the client secret, only Pilot (the caller) does.                                                                       |
| `PILOT_FEATURE_FLAGS_REDIS_URL`                         | To use `web-search`/`code-sandbox`/connectors | Redis endpoint backing the three platform circuit breakers (`webSearchEnabled`, `codeSandboxEnabled`, `connectorsEnabled` — see `src/mastra/server/feature-flags.ts`), independent of any org's own preference and of Pilot's own database. Missing/unreachable fails closed (all disabled). |
| `PILOT_DEPLOY_ENVIRONMENT`                              | Optional                                      | `development`, `preview`, or `production` — set per deployment. Unset means `development`.                                                                                                                                                                                                   |
| `PILOT_ACTIVITY_CALLBACK_URL`                           | To use `web-search`/`scratchpad`/skills       | Fixed target for the activity and scratchpad callbacks into Pilot.                                                                                                                                                                                                                           |
| (none — `x-pilot-langsearch-api-key` header)            | To use `web-search`                           | pilot-ai is never run without Pilot in front of it, so LangSearch's key has no environment variable at all — Pilot forwards its admin-managed value as this header on every request.                                                                                                         |
| (none — `x-pilot-github-token` header)                  | Optional                                      | Same as above: Pilot forwards its admin-managed value as this header to raise the unauthenticated rate limit on the public-web GitHub tool. Never required either way.                                                                                                                       |
| `VERCEL_OIDC_TOKEN`                                     | Optional, Vercel only                         | `skills.sh` API auth for runtime skill preflight (unrelated to the WorkOS M2M runtime boundary — see `docs/architecture.md`). Unset outside Vercel just disables that one preflight step. Locally: `vercel link && vercel env pull`.                                                         |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`   | Optional, off Vercel                          | `@vercel/sandbox` authentication for the `code-sandbox` tool when not running on Vercel (no `VERCEL_OIDC_TOKEN` available). Create a personal access token at vercel.com/account/tokens.                                                                                                     |
| `PILOT_PROFILE`                                         | Optional                                      | Tuning profile for the public-web tools: `fast`, `balanced`, `deep`, or `test`.                                                                                                                                                                                                              |
| `PILOT_SEARCH_CACHE_TTL_MS`, `PILOT_FETCH_CACHE_TTL_MS` | Optional                                      | Override single cache TTL values from the selected profile.                                                                                                                                                                                                                                  |
| `PILOT_WORK_REDIS_URL`                                  | To run durable Pilot Work                     | Shared Redis endpoint (`rediss://` for managed TLS) required before a Work run can claim reconnectable observation across serverless instances. Keep server-only.                                                                                                                            |
| `PILOT_WORK_CACHE_TTL_SECONDS`                          | Optional                                      | Defaults to one hour; minimum 60.                                                                                                                                                                                                                                                            |

## Scripts

| Script                              | What it does                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | `mastra dev` — local Mastra playground on port 4111.                                                                                                                               |
| `pnpm build`                        | `mastra build`.                                                                                                                                                                    |
| `pnpm start`                        | `mastra start` — run the built runtime.                                                                                                                                            |
| `pnpm test`                         | `vitest run` — deterministic unit tests.                                                                                                                                           |
| `pnpm lint` / `pnpm lint:fix`       | ESLint, strict — must report zero problems.                                                                                                                                        |
| `pnpm typecheck`                    | `tsc --noEmit`.                                                                                                                                                                    |
| `pnpm format` / `pnpm format:check` | Prettier.                                                                                                                                                                          |
| `pnpm knip`                         | `knip --production` — unused exports/files/dependencies.                                                                                                                           |
| `pnpm check`                        | `lint && typecheck && format:check && knip`.                                                                                                                                       |
| `pnpm verify:memory`                | Opt-in live check: two Kilo Gateway generations across two processes proving Mastra memory survives a process restart, then deletes the randomized thread. Needs real credentials. |

Use these `pnpm` scripts instead of invoking `mastra dev` / `mastra build`
directly.

## Running it locally

```sh
pnpm install --frozen-lockfile
pnpm dev          # Mastra playground, http://localhost:4111
```

`api/v1/*` Vercel Functions are not exercised by `pnpm dev`; use the Vercel
CLI (`vercel dev`) or a deployed preview to exercise those directly (see the
`vercel` and `agent-browser` Claude Code skills under `.claude/skills/`).

## Verify pipeline

Run before calling any slice complete:

```sh
pnpm check                       # lint, typecheck, format:check, knip
pnpm build
pnpm test
pnpm audit --audit-level high
```

This is exactly what `.github/workflows/quality.yml` runs on every pull
request and push to `main` (build, typecheck, test, knip, audit), split so a
security-only failure (`pnpm audit`) is visually distinct in CI from a
build/test failure — see `.github/workflows/security.yml`.

A green build is not evidence of successful authentication or durable
execution — exercise the runtime API against a real deployment (or
`pnpm verify:memory` for memory persistence) before trusting a change that
touches auth, storage, or memory.
