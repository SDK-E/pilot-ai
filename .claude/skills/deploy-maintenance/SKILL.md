---
name: deploy-maintenance
description: Reset Mastra's own local devtool db files for this repo. Use when the user wants to wipe Mastra's playground/observability db files back to a clean state.
---

# Deploy maintenance (pilot-ai)

## Reset local devtool databases

`pnpm db:reset` deletes Mastra's own local sqlite files (playground/observability caches, unrelated to the actual runtime storage):

```bash
rm -f mastra.db mastra-editor.db pilot-memory.db database/pilot-browser.db
```

All four paths are gitignored and local-only. The actual runtime storage (`DATABASE_URL`, a Postgres/Neon database) has no local-file fallback and no reset equivalent here — never improvise a reset against a shared Postgres database without the user explicitly asking for it.
