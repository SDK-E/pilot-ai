# AGENTS.md — Storage

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- `runtime.ts` is the only place that resolves Mastra's storage backend.
  `getPilotRuntimeStorageConfig()` requires `TURSO_DATABASE_URL` and
  `TURSO_AUTH_TOKEN` together in Preview/Production (`VERCEL_ENV` set); it
  throws if only one is set, and it **refuses** to fall back to a local file
  store when `VERCEL_ENV` is `production` or `preview`.
- The local-file fallback (`src/.mastra/pilot-runtime.db`) only exists when
  neither Turso var is set and `VERCEL_ENV` is unset — i.e. local development
  only. Never rely on it, or ship code that would silently activate it, in a
  deployed environment.
- `createPilotRuntimeStorage(config)` returns the `LibSQLStore` every other
  storage-backed module (`memory/`, `cache/`) is built from.

## Invariants

- Use a dedicated Turso database per environment; never point this at
  Pilot's own application database.
- A missing or partial Turso config must fail loudly (throw), not silently
  degrade to an ephemeral store, in any environment where `VERCEL_ENV` is set.
