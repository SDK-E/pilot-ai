# AGENTS.md — Contracts

See the root [`AGENTS.md`](../../AGENTS.md) first; this file only adds what is
specific to this directory.

## Contract

- `conversation.ts` is the single wire contract shared with Pilot: the
  `GenerateConversationReply` command schema (`generateConversationReplySchema`,
  `.strict()`), `ALLOWED_TOOL_IDS`/`AllowedToolId`, `BASE_AGENT_IDS`/
  `BaseAgentId`, the legacy `conversational`/`research` → `chat` id mapping,
  and the deterministic memory resource/thread id helpers
  (`createConversationResourceId`, `createProjectResourceId`,
  `createMemoryResourceId`).
- This is a pure module: **zero `@mastra` imports, zero `process.env` reads.**
  It only depends on `zod`. Anything that needs Mastra types or runtime
  environment access belongs in `src/mastra/`, not here.
- Every field Pilot can send is validated here with an explicit bound (string
  `max()`, array `max()`, enum). A new field on the command must be schema'd
  the same way — never widen the schema to `z.unknown()` or drop `.strict()`.

## Invariants

- This file is the shared source of truth between the two repos for the
  command shape; changing a field here is a cross-repo breaking change and
  must be coordinated with Pilot's own command construction.
- `conversation.test.ts` covers the legacy id mapping and schema boundaries —
  extend it for any new field or accepted legacy value.
