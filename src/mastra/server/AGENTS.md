# AGENTS.md — Server

See the root [`AGENTS.md`](../../../AGENTS.md) first; this file only adds what
is specific to this directory.

## Contract

- This is the HTTP layer: OpenAI-compatible translation
  (`openai-compatible.ts`, `chat-completion-stream.ts`, `chat-completions.ts`),
  request parsing (`request-body.ts`, `html-sniff-filter.ts`), conversation
  lifecycle (`cleanup.ts` for delete/truncate), and Mastra custom route
  registrations (`routes/`).
- `routes/index.ts` exports `conversationApiRoutes`, the list wired into the
  Mastra instance in `src/mastra/index.ts`. Each `routes/*.ts` registration
  pairs a path with the handler that actually does the work — keep the
  registration thin and the logic in the sibling top-level file
  (`chat-completions.ts`, `cleanup.ts`, etc.).
- Every handler here that Mastra's custom API exposes must reject a
  non-POST or unauthenticated request — via
  `isVerifiedPilotRuntimeRequest`/`verifyPilotRuntimeRequest`
  (`src/mastra/auth/workos-m2m.ts`) — before parsing the body or touching
  Mastra state.

## Invariants

- Never derive organization, conversation, or execution identity from the
  request body; only from the verified execution record.
- Streaming responses (`chat-completion-stream.ts`) must not leak model
  reasoning, tool inputs/outputs, or internal processor state into the SSE
  payload beyond what the OpenAI Chat Completions contract expects.
