#!/usr/bin/env bash
set -euo pipefail

# Removes this project's deployments for one target (preview or production),
# skipping any with an active alias (--safe) so the live deployment is never
# touched — only old/stale builds get pruned.

TARGET="${1:-preview}"

urls="$(vercel list --environment "$TARGET" --json 2>/dev/null \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for d in data.get('deployments', []):
    print(d['url'])
")"

if [ -z "$urls" ]; then
  echo "no $TARGET deployments found"
  exit 0
fi

# Removed one at a time: a batched `xargs vercel remove` aborts the whole
# run if any single URL no longer matches an unaliased deployment — looping
# keeps that a per-deployment outcome instead. "Could not find unaliased
# deployments" is `--safe` doing its job (the URL is the live aliased
# deployment, or was already removed) — a normal skip, not a failure; any
# other error is real and fails the script.
status=0
for url in $urls; do
  output="$(vercel remove --safe --yes "$url" 2>&1)" && {
    echo "$output"
    continue
  }
  if echo "$output" | grep -q "Could not find unaliased deployments"; then
    echo "skipped $url (live/aliased, or already removed)"
  else
    echo "$output" >&2
    echo "warning: could not remove $url" >&2
    status=1
  fi
done
exit "$status"
