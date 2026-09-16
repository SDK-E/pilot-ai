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

echo "$urls" | xargs vercel remove --safe --yes
