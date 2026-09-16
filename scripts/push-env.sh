#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.local}"
ENVIRONMENT="${2:-development}"

if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found" >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$line" ] && continue
  case "$line" in
    '#'*) continue ;;
  esac

  name="${line%%=*}"
  value="${line#*=}"
  name="$(echo "$name" | sed 's/[[:space:]]*$//')"
  value="$(echo "$value" | sed 's/^[[:space:]]*//')"

  [ -z "$name" ] && continue

  if [[ "$value" == \"*\" && "$value" == *\" && ${#value} -ge 2 ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' && ${#value} -ge 2 ]]; then
    value="${value:1:${#value}-2}"
  fi

  # vercel env add fails if the var already exists for this environment;
  # remove it first so the script is safe to re-run (an env "switcher").
  vercel env rm "$name" "$ENVIRONMENT" --yes >/dev/null 2>&1 || true
  # --no-sensitive: Preview/Production vars default to "Sensitive" (write-only
  # — `vercel env pull` returns a literal "[SENSITIVE]" placeholder instead of
  # the value), which silently breaks the local env-switcher workflow. Keep
  # every var pull-able so switching environments locally actually works.
  # vercel strips a trailing newline from stdin itself; keep it here so an
  # empty value still sends one byte, since a fully empty stdin hangs the CLI.
  printf '%s\n' "$value" | vercel env add "$name" "$ENVIRONMENT" --yes --no-sensitive >/dev/null
  echo "set $name -> $ENVIRONMENT"
done < "$ENV_FILE"
