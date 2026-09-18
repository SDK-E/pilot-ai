# AGENTS.md — Cache

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- `generic-cache.ts` implements a table-backed cache over the runtime
  Postgres pool; `index.ts` exposes it as a module-level singleton
  (`setRuntimeCache`, `makeCacheKey`, `getCachedValue`, `setCachedValue`) that
  the web tools (`src/mastra/tools/web/`, `src/mastra/tools/search/`) share
  for response caching, keyed by `pilot_tool_cache`.
- `domain-circuit-breaker.ts` tracks per-domain failure state for the public
  web tools so a repeatedly-failing host doesn't get hit again inside the
  same run.
- `setRuntimeCache` must be called during runtime setup
  (`src/mastra/setup/web-tools.ts`) before any tool calls `getCachedValue` /
  `setCachedValue`; both throw if the cache was never configured
  (`requireCache`) rather than degrading silently.

## Invariants

- This module is a **tool-response** cache only — it is not the durable Work
  cache (that's `src/mastra/work/`, backed by Redis) and must not be used for
  anything that needs to survive a serverless instance change with
  reconnectable event history.
- Cache TTLs come from `PILOT_PROFILE` / `PILOT_*_MS` env values
  (`src/mastra/setup/web-tools.ts`), not hardcoded per call site.
