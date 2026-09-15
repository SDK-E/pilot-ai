# Pilot AI

The Mastra runtime behind [Pilot](https://github.com/SDK-E/pilot), an AI
agent product with three kinds — **Chat**, **Work**, and **Code** — built
from one base agent that differs only in instructions and capabilities.
Pilot owns authentication, organizations, conversations, and approvals; this
service owns agent construction, memory, and the protected runtime API
(`POST /v1/chat/completions`, OpenAI Chat Completions-compatible) that Pilot
calls with a short-lived WorkOS M2M token.

## Quick start

Requires Node.js 24 and pnpm.

```sh
cp .env.example .env      # fill in KILO_API_KEY at minimum; see docs/development.md
pnpm install --frozen-lockfile
pnpm dev                  # Mastra playground at http://localhost:4111
```

Without `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` set, local development uses a
local-only SQLite file (`src/.mastra/pilot-runtime.db`) automatically.

## Learn more

- [`docs/architecture.md`](docs/architecture.md) — agent kinds, capabilities,
  project structure, and the runtime API.
- [`docs/development.md`](docs/development.md) — full environment variable
  reference, script reference, and the verify pipeline.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to propose a change and the
  checks a PR must pass.
- [`AGENTS.md`](AGENTS.md) — conventions for AI coding agents working in this
  repo (also the root instructions Claude Code and similar tools read).
