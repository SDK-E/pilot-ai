#!/usr/bin/env bash
set -euo pipefail

# `vercel env pull` merges into an existing file — it *keeps* any local var
# not present in the target environment instead of removing it, so a var
# retired on Vercel (or a stray local-only line) lingers forever. Delete the
# file first so a pull always fully mirrors that environment.

ENV_FILE="${1:-.env.local}"
ENVIRONMENT="${2:-development}"

rm -f "$ENV_FILE"
vercel env pull --environment="$ENVIRONMENT" "$ENV_FILE"
