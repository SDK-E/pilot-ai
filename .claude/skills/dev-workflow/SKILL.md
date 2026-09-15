---
name: dev-workflow
description: "How to develop, verify, and land changes in the pilot-ai Mastra runtime repo. Use whenever running scripts, opening a branch/PR, or deciding whether a change is ready to commit."
---

# Dev workflow (pilot-ai)

## Scripts (from `package.json`)

| Script                              | What it does                                                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | `mastra dev` — local Mastra playground, port 4111.                                                                                                                                                  |
| `pnpm build`                        | `mastra build`.                                                                                                                                                                                     |
| `pnpm start`                        | `mastra start` — run the built runtime.                                                                                                                                                             |
| `pnpm test`                         | `vitest run` — deterministic unit tests.                                                                                                                                                            |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (flat config, `eslint.config.mjs`), strict — zero problems required.                                                                                                                         |
| `pnpm typecheck`                    | `tsc --noEmit`.                                                                                                                                                                                     |
| `pnpm format` / `pnpm format:check` | Prettier.                                                                                                                                                                                           |
| `pnpm knip`                         | `knip --production` — finds unused exports/files/deps.                                                                                                                                              |
| `pnpm check`                        | `lint && typecheck && format:check && knip` — the one command to run before calling anything done.                                                                                                  |
| `pnpm verify:memory`                | Opt-in **live** check: two Kilo Gateway generations across two processes proving Mastra memory survives a restart, then deletes the randomized thread. Needs real credentials; do not run it in CI. |

Never run `mastra dev` / `mastra build` directly — always go through the `pnpm` scripts (AGENTS.md rule), since they may wrap extra setup.

## Maps to CI

`.github/workflows/quality.yml` runs on every PR and push to `main`:
install (`pnpm install --frozen-lockfile`) → `pnpm build` → `pnpm typecheck` → `pnpm test` → `pnpm knip` → `pnpm audit --audit-level high`.

That is `pnpm check`'s lint/typecheck/format/knip plus build, test, and audit — run `pnpm check && pnpm build && pnpm test` locally before pushing to catch everything CI will catch (audit needs network and is usually skipped locally).

## Code style invariants (enforced by ESLint, not just convention)

- Files: max 300 lines (`max-lines`, blank/comment lines excluded).
- Functions: max 60 lines (`max-lines-per-function`).
- `complexity: 10`, `max-depth: 3`, `max-params: 4`, `max-nested-callbacks: 3`.
- No `console.*` outside `*.test.ts`, `src/evals/**`, `scripts/**`.
- Relative imports require an explicit `.js` extension — the Vercel functions run unbundled on Node ESM and won't resolve extensionless specifiers (`import-x/extensions`).
- Import order is enforced and alphabetized (`import-x/order`).

## Conventions

- ESM only (`"type": "module"`), Node 24, pnpm (`packageManager` pinned in `package.json`).
- Domain code lives under `src/mastra/<area>/`; `src/contracts/` is pure request/response types shared with Pilot — zero `@mastra` imports, zero `process.env` reads.
- Every agent is built from the base agent (`src/mastra/agents/base/agent.ts`) plus one kind (`src/mastra/agents/kinds.ts`); shared behavior never lives inside a kind file.
- Before writing Mastra-specific code, verify current APIs against `https://mastra.ai/llms.txt` or the installed package types — do not rely on training-data knowledge of Mastra (see root `AGENTS.md` and the vendored `mastra` skill).
- Commit only after `pnpm check`, `pnpm build`, and `pnpm test` are clean.
