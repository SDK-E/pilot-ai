---
name: env-sync
description: Pull, push, sync, and verify Vercel environment variables between .env.local and Vercel across development/preview/production for this repo. Use whenever the user wants to sync env vars, check for missing/misconfigured env vars, mirror Vercel's env vars locally, push local .env.local changes up to Vercel, or asks things like "pull prod env", "why is X env var missing", "make my env vars match Vercel".
---

# Env sync (pilot-ai)

Four scripts in `scripts/`, exposed as pnpm commands. Each takes an environment suffix: none = development, `:preview`, `:production`.

## Commands

- `pnpm env:pull[:preview|:production]` — `scripts/pull-env.sh`. Deletes `.env.local` first, then re-pulls fresh from Vercel (`vercel env pull`). This is a **mirror**, not a merge — anything only in the old local file is gone after this. Use it to point local dev at a different environment.
- `pnpm env:push[:preview|:production]` — `scripts/push-env.sh`. Reads `.env.local`, pushes each var to Vercel with `vercel env rm` + `vercel env add --no-sensitive` (idempotent — safe to re-run). Use it to publish local changes upward.
- `pnpm env:sync[:preview|:production]` — `scripts/sync-env.sh`. Runs push, then diffs local var names against `vercel env ls` and **removes from Vercel** anything not present in `.env.local`. This is destructive to Vercel state — only use it when `.env.local` is the source of truth you actually want mirrored.
- `pnpm env:check[:preview|:production]` — `scripts/check-env.sh`. Read-only. Reports MISSING/OK per required var (reads `.env.local` for development, `vercel env ls` for preview/production). Exits 1 if anything required is missing. Safe to run anytime, including as a pre-flight before push/sync.

## Why this order matters

Pull is destructive to the *local* file; push/sync are destructive to *Vercel*. Always run `env:check` after any pull/push/sync to confirm the result — a green build isn't evidence the right vars are actually set.

Vars added via `vercel env add` without `--no-sensitive` come back as `"[SENSITIVE]"` on pull and can't be read locally — these scripts always pass `--no-sensitive`, but a var added by hand outside these scripts might not be, which check-env can't distinguish from truly missing.

This repo (pilot-ai) also reads `EDGE_CONFIG` for the `webSearchEnabled`/`codeSandboxEnabled`/`connectorsEnabled` circuit-breaker flags — those live in Vercel Edge Config, not in `.env.local`/`vercel env`, so these scripts don't touch them. Managing those is a separate concern from this env-var sync.

## When to just ask instead of running sync

`env:sync` deletes Vercel vars. If the user's `.env.local` might be stale or incomplete (e.g. they haven't pulled recently), run `env:pull` first, or at minimum `env:check`, before running `sync` — otherwise you can delete vars from Vercel that were correct and just missing locally.
