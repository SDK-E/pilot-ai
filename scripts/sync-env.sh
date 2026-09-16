#!/usr/bin/env bash
set -euo pipefail

# Makes a Vercel environment's vars exactly match ENV_FILE: every var in
# ENV_FILE is added/updated (via push-env.sh), and every var Vercel has for
# that environment but ENV_FILE does *not* define is removed. Unlike
# push-env.sh (upsert-only), this can delete vars — review ENV_FILE before
# running it against preview/production.

ENV_FILE="${1:-.env.local}"
ENVIRONMENT="${2:-development}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found" >&2
  exit 1
fi

"$SCRIPT_DIR/push-env.sh" "$ENV_FILE" "$ENVIRONMENT"

local_names=()
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$line" ] && continue
  case "$line" in
    '#'*) continue ;;
  esac
  name="${line%%=*}"
  name="$(echo "$name" | sed 's/[[:space:]]*$//')"
  [ -z "$name" ] && continue
  local_names+=("$name")
done < "$ENV_FILE"

is_local_name() {
  local candidate="$1"
  local name
  for name in "${local_names[@]}"; do
    [ "$name" = "$candidate" ] && return 0
  done
  return 1
}

remote_names="$(vercel env ls "$ENVIRONMENT" 2>&1 \
  | grep -E '^[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]+' \
  | awk '{print $1}' \
  | sort -u \
  | grep -v '^name$')"

while IFS= read -r name; do
  [ -z "$name" ] && continue
  if ! is_local_name "$name"; then
    echo "removing $name (not in $ENV_FILE) -> $ENVIRONMENT"
    vercel env rm "$name" "$ENVIRONMENT" --yes >/dev/null 2>&1 || true
  fi
done <<< "$remote_names"

echo "synced $ENV_FILE -> $ENVIRONMENT"
