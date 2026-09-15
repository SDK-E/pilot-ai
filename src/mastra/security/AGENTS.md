# AGENTS.md — Security

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- `public-url.ts` exports `assertPublicHttpUrl`, the single boundary that
  every model-controlled URL fetch must pass through — the initial URL **and**
  each redirect hop. It rejects: non-`http(s)` schemes, credential-bearing
  URLs (`user:pass@`), loopback/private/link-local addresses, local hostname
  suffixes (`.localhost`, `.local`, `.internal`, `.test`), bare hostnames with
  no dot, and any DNS answer set containing even one non-public address
  (mixed-DNS defense).
- `isPublicIpAddress` is exported separately because callers sometimes have an
  address already in hand (e.g. a redirect `Location` that resolved) and
  don't need a fresh DNS lookup.

## Invariants

- Do not add a second URL-validation helper elsewhere — every fetch tool in
  `src/mastra/tools/web/` and `src/mastra/tools/search/` must call this one so
  the guard only needs auditing in one place.
- `public-url.test.ts` fixtures intentionally hardcode private/link-local IPs
  to prove rejection (`sonarjs/no-hardcoded-ip` is disabled for `*.test.ts`
  for exactly this reason) — keep new negative cases there, not inline in
  production tool code.
- This directory is about network-egress safety only. Auth verification lives
  in `src/mastra/auth/` (see its own `AGENTS.md`) — don't blend the two.
