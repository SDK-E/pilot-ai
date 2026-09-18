# AGENTS.md — Storage

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- `runtime.ts` is the only place that resolves Mastra's storage backend.
  `getPilotRuntimeStorageConfig()` requires `DATABASE_URL` (a Postgres/Neon
  connection string, set locally by `neon link`). In a real deployment
  (`RENDER=true`, or `VERCEL_ENV` set to `production`/`preview`) a missing
  value returns `undefined` rather than throwing, so the caller can surface
  "not configured" as a 503 instead of a crash; outside a deployment it
  throws immediately, since there is no local fallback store.
- `createPilotRuntimeStorage(config)` returns the `PostgresStore` every other
  storage-backed module (`memory/`, `cache/`) is built from.

## Invariants

- Use a dedicated Postgres database per environment; never point this at
  Pilot's own application database.
- A missing `DATABASE_URL` must fail loudly, not silently degrade to an
  ephemeral store, in any real deployment.
