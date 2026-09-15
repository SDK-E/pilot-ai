## Summary

<!-- What does this change do, and why? -->

## Related issue

<!-- Closes #... -->

## Checklist

- [ ] `pnpm check` (lint, typecheck, format:check, knip) passes
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] `pnpm knip` passes (also covered by `pnpm check`)
- [ ] `pnpm audit --audit-level high` passes, or any new advisory is noted below
- [ ] `pnpm verify:memory` run locally, if this touches memory or storage
- [ ] Root `AGENTS.md` / affected directory `AGENTS.md` updated if this changes a contract or invariant
- [ ] No prompts, tool inputs/outputs, secrets, or model reasoning added to any activity/callback payload

## Notes for reviewers

<!-- Anything that needs manual verification (auth, durable execution, a live deploy check). A green build is not evidence of successful authentication or durable execution. -->
