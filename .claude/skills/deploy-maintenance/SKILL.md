---
name: deploy-maintenance
description: Clean up stale Vercel preview/production deployments, or reset Mastra's own local devtool db files, for this repo. Use when the user wants to prune old Vercel deployments, free up deployment slots, or wipe Mastra's playground/observability db files back to a clean state.
---

# Deploy maintenance (pilot-ai)

Two independent, unrelated tools.

## Clean old deployments

`pnpm deploy:clean` (preview) / `pnpm deploy:clean:production` — runs `scripts/clean-deployments.sh <target>`:

```bash
vercel list --environment "$TARGET" --json | <extract urls> | xargs vercel remove --safe --yes
```

Removes deployments for the given environment via `vercel remove --safe` (safe mode won't remove a deployment that's the current alias target). Use this to prune accumulated preview deployments; think twice before running the `:production` variant since it operates on production deployment history, not just previews.

## Reset local devtool databases

`pnpm db:reset` deletes Mastra's own local sqlite files (playground/observability caches, unrelated to the actual runtime storage):

```bash
rm -f mastra.db mastra-editor.db pilot-memory.db database/pilot-browser.db
```

All four paths are gitignored and local-only. The actual runtime storage (`DATABASE_URL`, a Postgres/Neon database) has no local-file fallback and no reset equivalent here — never improvise a reset against a shared Postgres database without the user explicitly asking for it.
