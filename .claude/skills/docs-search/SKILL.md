---
name: docs-search
description: Search this repo's Markdown documentation (docs/, ADRs, AGENTS.md, README) by keyword with ripgrep, without loading whole files into context. Use whenever you need to find where something is documented, check a past decision, or answer "why did we do X" before reading full files — much cheaper than grepping or reading docs/ manually.
---

# Docs search (pilot-ai)

`pnpm docs:search "<query>" [context-lines]` runs `scripts/docs-search.sh`:

```bash
rg --color=never --heading --line-number --context "$CONTEXT" --ignore-case --glob '*.md' -- "$QUERY" .
```

- Case-insensitive, `.md` files only, respects `.gitignore` automatically (ripgrep default).
- `context-lines` defaults to 2 — bump it (e.g. 5-10) when a snippet needs more surrounding prose to be useful.
- Quote multi-word queries.

## When to use this instead of Read/Grep

Prefer this over opening `docs/architecture.md`, `docs/development.md`, `docs/decisions/*.md`, or `AGENTS.md` wholesale when you only need a specific fact — e.g. "what does the feature-flags doc say about VERCEL_ENV" or "is there a decision on connector auth." It returns just the matching lines with context, not the whole file, which keeps token usage down when the docs directory is large.

If a match looks relevant but the snippet is too thin to be sure, follow up by reading that specific file/section rather than re-running with a huge context window.
