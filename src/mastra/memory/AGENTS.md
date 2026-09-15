# AGENTS.md — Memory

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- `project-memory.ts` builds Mastra `Memory` instances against the shared
  `LibSQLStore` from `src/mastra/storage/runtime.ts`:
  `createConversationMemory` (per-conversation thread, message history only)
  and `createProjectMemory` (adds `observationalMemory` scoped to the Pilot
  project resource, only reachable when Pilot sends a server-authorized
  project command with `sharedMemoryEnabled: true`).
- Memory resource/thread ids are deterministic and derived in
  `src/contracts/conversation.ts` (`createConversationResourceId`,
  `createProjectResourceId`, `createMemoryResourceId`) — never invent an id
  here; always resolve through those helpers so isolation between
  organizations/workers/projects is structural, not convention.
- `lastMessages` and other tuning values come from
  `src/mastra/agents/base/limits.ts`, not hardcoded here.

## Invariants

- No in-memory or file-backed fallback in the deployed path — memory always
  goes through the Turso-backed `LibSQLStore` (`src/mastra/storage/AGENTS.md`).
- A conversation must never be able to read another organization's or
  worker's memory; that guarantee comes entirely from the resource/thread id
  construction above, so don't bypass it with a hand-built id string.
