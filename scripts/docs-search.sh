#!/usr/bin/env bash
set -euo pipefail

# Low-token doc search for agents: greps only documentation (docs/, root
# *.md, every nested AGENTS.md, .claude/skills/**/SKILL.md) instead of
# reading whole files to find one paragraph. Respects .gitignore, so
# node_modules/.next/etc. are never searched.
#
# Usage: docs-search.sh <query> [context-lines]

QUERY="${1:?usage: docs-search.sh <query> [context-lines]}"
CONTEXT="${2:-2}"

rg --color=never --heading --line-number --context "$CONTEXT" --ignore-case \
  --glob '*.md' \
  -- "$QUERY" . \
  || echo "no matches for: $QUERY"
