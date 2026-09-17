---
name: docs-search
description: Search this repo's text — Markdown docs by default, or source code with --code — by keyword with ripgrep, without loading whole files into context. Use whenever you need to find where something is documented, check a past decision, answer "why did we do X", or locate a literal string/identifier across .ts/.tsx source before reading full files — much cheaper than grepping or reading manually.
---

# Docs & code search (pilot)

`pnpm docs:search "<query>" [context-lines] [--code|--all]` runs `scripts/docs-search.sh`:

```bash
rg --color=never --heading --line-number --context "$CONTEXT" --ignore-case "${GLOBS[@]}" -- "$QUERY" .
```

- Case-insensitive, respects `.gitignore` automatically (ripgrep default).
- `context-lines` defaults to 2 — bump it (e.g. 5-10) when a snippet needs more surrounding prose to be useful.
- Quote multi-word queries.
- No third argument (default): docs only — `docs/`, root `*.md`, every nested `AGENTS.md`, `.claude/skills/**/SKILL.md`.
- `--code`: source only — `*.ts`, `*.tsx`, `*.js`, `*.mjs`, `*.cjs`. Use this for a literal string, regex fragment, header name, or identifier that isn't an import/export relationship (for that, use `code-graph` instead).
- `--all`: no glob filter — searches every text file ripgrep would normally search (docs and source together, plus anything else text-based).

## When to use this instead of Read/Grep

Prefer this over opening `docs/progress.md`, `docs/decisions/*.md`, or `AGENTS.md` wholesale when you only need a specific fact — e.g. "what does ADR-0021 say about connector write actions" or "is there a decision on X env var". It returns just the matching lines with context, not the whole file, which keeps token usage down when the docs directory is large.

Prefer `--code` over a raw `grep -r` when you need to find a literal string, a header name, a regex fragment, or every place a constant is referenced — anything that isn't specifically an import/export relationship. It's the same low-context, matches-only output, scoped to source instead of docs.

If a match looks relevant but the snippet is too thin to be sure, follow up by reading that specific file/section rather than re-running with a huge context window.
