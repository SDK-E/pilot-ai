# AGENTS.md — Work

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- `durable-cache.ts` is the durable Pilot **Work** cache: a Redis-backed
  `RedisServerCache` (`@mastra/redis`) that lets a Work run stay observable
  and reconnectable after a request moves to a different serverless instance.
- `getPilotDurableWorkConfig()` reads `PILOT_WORK_REDIS_URL` (must be
  `redis://` or `rediss://`) and `PILOT_WORK_CACHE_TTL_SECONDS` (integer,
  minimum 60, default 3600). It returns `undefined` — not a fallback config —
  when `PILOT_WORK_REDIS_URL` is unset.
- `createPilotDurableWorkCache(config)` builds the `ioredis` client with
  `enableOfflineQueue: false` and `lazyConnect: true`, and wraps it with a
  `pilot:work:` key prefix.

## Invariants

- This is fail-closed by design: a Work run that needs reconnectable
  observation must not proceed on an in-memory cache when Redis isn't
  configured — an in-memory cache would make the run _appear_ durable while
  silently losing its event history the moment the instance recycles. Do not
  add a fallback branch here to make local development more convenient.
- Keep `PILOT_WORK_REDIS_URL` server-only; never surface it or a derived
  connection string to a tool, callback payload, or client response.
