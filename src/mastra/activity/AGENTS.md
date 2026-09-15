# AGENTS.md — Activity

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- `callback-url.ts` resolves the fixed `PILOT_ACTIVITY_CALLBACK_URL` that
  every activity/scratchpad callback targets — never a model- or
  request-supplied URL.
- `reporter.ts` (`createPilotActivityReporter`) validates every event against
  a `.strict()` Zod schema before sending it: a `tool` event (capability id
  from the fixed enum, execution id, call id, lifecycle `state`, optional
  bounded `detail`) or a `skill` event (execution id, a pattern-validated
  skill id). It posts with the verified `x-pilot-runtime-token` header and
  throws on a non-OK response.
- `tool-detail.ts` builds the bounded (~4000 char), server-formatted `detail`
  string for a completed tool call — see ADR-0018 ("Tool call transparency")
  in the sibling `pilot` repo (`docs/decisions/0018-tool-call-transparency.md`)
  for the record shape this feeds.

## Invariants

- Never send prompts, tool inputs/outputs, raw URLs, errors, or model
  reasoning through this callback — only the fixed field set the Zod schemas
  allow, and `detail` only via `tool-detail.ts`'s fixed per-capability
  formatter, never as free-form text from a caller.
- Organization, conversation, and execution identity in an activity event
  must come from the active, already-verified execution record — this module
  never accepts or trusts an id from model output.
