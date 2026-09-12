# AGENTS.md — Conversation

## Purpose

`pilot-ai/src/conversation/` contains the OpenAI-compatible runtime API and contract DTOs.

## Key files

- `contract.ts` — Pure contract module (schema, type, helpers, constants). Zero @mastra/*, zero process.env.
- `command.ts` — Re-exports from contract.ts
- `config.ts` — Runtime config (maxRetries, maxSteps, tokenLimit, lastMessages)
- `openai-compatible.ts` — Chat completion request parsing, command reconstruction, streaming
- `api/index.ts` — API route registrations (5 routes)
- `api/chat-completions.ts` — POST /v1/chat/completions handler
- `api/approval-resume-route.ts` — POST /v1/approvals/resume handler
- `verify-memory.ts` — Memory verification script

## Rules

- `contract.ts` is the single source of truth for the GenerateConversationReply DTO.
- modelId is `PILOT_CONVERSATION_MODEL_ID` ("kilo/kilo-auto/free") from contract.ts.
- OIDC verification required on every runtime request (see `runtime/auth/vercel-oidc.ts`).
