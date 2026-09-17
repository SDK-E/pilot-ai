#!/usr/bin/env bash
set -euo pipefail

# Low-token text search for agents: greps only a chosen slice of the repo
# instead of reading whole files to find one paragraph or one literal
# string. Respects .gitignore, so node_modules/.next/etc. are never
# searched.
#
# Usage: docs-search.sh <query> [context-lines] [--code|--all]
#   (default)  docs only: docs/, root *.md, every nested AGENTS.md,
#              .claude/skills/**/SKILL.md
#   --code     source only: *.ts, *.tsx, *.js, *.mjs, *.cjs
#   --all      no glob filter — every text file ripgrep would normally search

QUERY="${1:?usage: docs-search.sh <query> [context-lines] [--code|--all]}"
CONTEXT="${2:-2}"
MODE="${3:-}"

case "$MODE" in
  --code)
    GLOBS=(-g '*.ts' -g '*.tsx' -g '*.js' -g '*.mjs' -g '*.cjs')
    ;;
  --all)
    GLOBS=()
    ;;
  "")
    GLOBS=(-g '*.md')
    ;;
  *)
    echo "usage: docs-search.sh <query> [context-lines] [--code|--all]" >&2
    exit 1
    ;;
esac

rg --color=never --heading --line-number --context "$CONTEXT" --ignore-case \
  "${GLOBS[@]}" \
  -- "$QUERY" . \
  || echo "no matches for: $QUERY"
