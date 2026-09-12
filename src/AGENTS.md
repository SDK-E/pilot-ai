# AGENTS.md — Runtime

## Structure

- `src/conversation/` — OpenAI-compatible API routes, command schema, contract DTOs
  - `contract.ts` — Pure DTO contract (no @mastra/*, no process.env)
  - `command.ts` — Re-exports from contract
  - `config.ts` — Runtime config (maxRetries, maxSteps, tokenLimit, lastMessages)
  - `openai-compatible.ts` — Chat completion parsing and streaming
  - `api/index.ts` — API route registrations
  - `api/chat-completions.ts` — POST /v1/chat/completions handler
  - `api/approval-resume-route.ts` — POST /v1/approvals/resume handler
  - `api/conversation-delete.ts` — POST /v1/conversations/delete handler
  - `api/project-delete.ts` — POST /v1/projects/delete-memory handler
- `src/runtime/` — Mastra runtime implementation
  - `auth/vercel-oidc.ts` — Vercel OIDC verification
  - `storage/pilot-runtime.ts` — Runtime storage config
  - `memory/project-memory.ts` — Memory creation helpers
  - `agent/base-agent.ts` — BaseAgent factory
- `src/research/` — Research agent implementation

## Rules

- `src/conversation/contract.ts` is pure — zero @mastra/*, zero process.env.
- All runtime routes validate Pilot's Vercel OIDC token before parsing tenant headers.
- No @mastra/* imports in pilot domain; no Pilot domain imports in pilot-ai/src/runtime.
