# Contributing

pilot-ai is proprietary software (see [`LICENSE`](LICENSE)); this guide is
for people and agents with write access to this repository.

## Proposing a change

1. Open an issue first for anything nontrivial (a new capability, a new
   agent kind, a schema change to `src/contracts/`) so the approach can be
   agreed before code is written. Small fixes can go straight to a PR.
2. Read the root [`AGENTS.md`](AGENTS.md) and [`docs/architecture.md`](docs/architecture.md)
   before writing Mastra code — every agent is built from the base agent plus
   one kind; do not duplicate shared behavior inside a kind file.
3. Before any Mastra-specific code, verify current APIs against
   `https://mastra.ai/llms.txt` or the installed package types in
   `node_modules/@mastra/`. Do not rely on training-data knowledge of Mastra;
   its APIs change between versions.

## Branch and PR flow

- Branch from `main`; name branches descriptively (`feature/…`, `fix/…`).
- Keep PRs scoped to one change. Commit messages should explain _why_, not
  just _what_.
- Open the PR as a draft until the checks below are green and the diff is
  ready for review.

## Required checks before opening a PR

```sh
pnpm check                       # lint, typecheck, format:check, knip
pnpm build
pnpm test
pnpm knip
pnpm audit --audit-level high
```

`pnpm check` already runs `knip`; it's listed separately here because it is
also its own required CI job. All of the above run in
[`.github/workflows/quality.yml`](.github/workflows/quality.yml) and
[`.github/workflows/security.yml`](.github/workflows/security.yml) on every
pull request; a PR won't merge until they pass.

`pnpm verify:memory` is a separate, opt-in **live** check (real Kilo Gateway
credentials, two process runs) for anything touching Mastra memory
persistence — run it locally when your change touches `src/mastra/memory/`
or `src/mastra/storage/`; it does not run in CI.

## Code style

- ESLint is fully strict (`pnpm exec eslint .` must report zero problems),
  as are `tsc --noEmit`, `knip`, and `prettier --check`.
- Files: 300-line maximum (`eslint.config.mjs`, `max-lines`, blank/comment
  lines excluded). Functions: 60-line maximum (`max-lines-per-function`).
  These are enforced by lint, not just convention — there is no separate,
  higher limit for any file type in this repo.
- Relative imports carry an explicit `.js` extension; Vercel Functions run
  unbundled on Node ESM and won't resolve extensionless specifiers.
- Every rule override in `eslint.config.mjs` carries a comment saying why —
  match that pattern if you need a new one.
- Domain code lives under `src/mastra/<area>/`; `src/contracts/` stays a pure
  module (zero `@mastra` imports, zero `process.env`).

## Security

Read the "Security rules" section of the root `AGENTS.md` before touching
`src/mastra/auth/`, any `/v1/*` runtime route, or the activity/scratchpad
callbacks — in short: verify the WorkOS M2M token before parsing a request
body, derive ownership only from the verified execution record, and never
send prompts, tool inputs/outputs, or reasoning through the Pilot activity
callback.
