---
name: deploy-maintenance
description: Clean up stale Vercel preview/production deployments, or reset the local dev database (sqlite/libsql files), for this repo. Use when the user wants to prune old Vercel deployments, free up deployment slots, or wipe local Mastra/memory db files back to a clean state.
---

# Deploy maintenance (pilot-ai)

Two independent, unrelated tools.

## Clean old deployments

`pnpm deploy:clean` (preview) / `pnpm deploy:clean:production` — runs `scripts/clean-deployments.sh <target>`:

```bash
vercel list --environment "$TARGET" --json | <extract urls> | xargs vercel remove --safe --yes
```

Removes deployments for the given environment via `vercel remove --safe` (safe mode won't remove a deployment that's the current alias target). Use this to prune accumulated preview deployments; think twice before running the `:production` variant since it operates on production deployment history, not just previews.

## Reset local database

`pnpm db:reset` just deletes the local sqlite/libsql files:

```bash
rm -f mastra.db mastra-editor.db pilot-memory.db database/pilot-browser.db src/.mastra/pilot-runtime.db
```

All five paths are gitignored — this only ever touches local files, never a remote Turso database. If `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are set (remote Turso instead of the local sqlite fallback), this script does nothing useful — there's no remote-reset equivalent here, and you should not improvise one against a shared Turso instance without the user explicitly asking for it.
