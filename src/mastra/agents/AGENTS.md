# AGENTS.md — Agents

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- `kinds.ts` is the single source of truth for `AGENT_KINDS`: each of `chat`,
  `work`, `code` declares only its `identity`, `instructions`, allowed
  `capabilities`, and step `limits`. `chat.ts`, `work.ts`, `code.ts` each hold
  one kind's identity/instructions and nothing else.
- No file in this directory (or its `base/` subtree) is a registered Mastra
  agent — `src/mastra/index.ts` never imports from here. Agents are built
  per request in `runtime/agent-factory.ts` from `AGENT_KINDS` plus the
  granted capabilities on the incoming command.
- `base/` is the shared agent: `base/agent.ts` (`createBaseAgent`, the
  reliability/processor pipeline every kind gets), `base/capabilities/` (the
  capability id → tools/instructions/approvability table), `base/pipeline/`
  (input processors by concern), `base/profiles/` (tuning profiles),
  `base/identity.ts`, `base/limits.ts`, `base/shared-instructions.ts`,
  `base/skill-preflight.ts`.
- Anything reusable across kinds belongs in `base/` or another shared
  `src/mastra/*` folder — never duplicated inside `chat.ts`/`work.ts`/`code.ts`.
- `runtime/` is the request-scoped layer: `agent-factory.ts` builds the actual
  `Agent` instance for one command, `runtime.ts` drives generate/stream,
  `suspensions.ts` handles `ask_user`/approval resume, `results.ts` shapes the
  response contract.

## Invariants

- A capability reaches an agent only through `base/capabilities/`, and only
  when it's both in the kind's `capabilities` list and in the request's
  granted set — see `src/contracts/conversation.ts` for the wire shape.
- `web-search` capability also attaches the evidence processors (source
  confidence, recency, contradiction, diversity, entity resolution, memory
  hygiene); don't attach them unconditionally to the base pipeline.
