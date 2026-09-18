#!/usr/bin/env bash
set -euo pipefail

# Reports which env vars pilot-ai needs are missing, so a gap shows up here
# instead of as a runtime crash. `development` reads .env.local (what your
# local server actually sees); `preview`/`production` query Vercel directly
# (what that deployment actually has), since .env.local may be stale.

ENVIRONMENT="${1:-development}"

REQUIRED_ALWAYS=(
  KILO_API_KEY
  WORKOS_M2M_AUTHKIT_DOMAIN
  WORKOS_M2M_CLIENT_ID
)
REQUIRED_DEPLOYED=(
  TURSO_DATABASE_URL
  TURSO_AUTH_TOKEN
)
REQUIRED_FEATURES=(
  PILOT_ACTIVITY_CALLBACK_URL
  LANGSEARCH_API_KEY
  PILOT_WORK_REDIS_URL
  EDGE_CONFIG
)
OPTIONAL=(
  PILOT_LOG_LEVEL
  PILOT_PROFILE
  PILOT_SEARCH_CACHE_TTL_MS
  PILOT_FETCH_CACHE_TTL_MS
  PILOT_FETCH_TIMEOUT_MS
  PILOT_CIRCUIT_BREAKER_FAILURES
  PILOT_CIRCUIT_BREAKER_BLOCK_MS
  PILOT_WORK_CACHE_TTL_SECONDS
  GITHUB_TOKEN
  VERCEL_OIDC_TOKEN
)

if [ "$ENVIRONMENT" = "development" ]; then
  SOURCE_DESC=".env.local"
  ENV_FILE="${2:-.env.local}"
  present() {
    [ -f "$ENV_FILE" ] && grep -qE "^$1=.+" "$ENV_FILE"
  }
else
  SOURCE_DESC="Vercel ($ENVIRONMENT)"
  REMOTE_NAMES="$(vercel env ls "$ENVIRONMENT" 2>&1 \
    | grep -E '^[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]+' \
    | awk '{print $1}' \
    | sort -u \
    | grep -v '^name$')"
  present() {
    printf '%s\n' "$REMOTE_NAMES" | grep -qx "$1"
  }
fi

missing_required=0
echo "Checking pilot-ai against $SOURCE_DESC"
echo

check_group() {
  local label="$1"
  shift
  echo "-- $label --"
  local name
  for name in "$@"; do
    if present "$name"; then
      echo "  OK      $name"
    else
      echo "  MISSING $name"
      missing_required=1
    fi
  done
}

check_group "Always required" "${REQUIRED_ALWAYS[@]}"
if [ "$ENVIRONMENT" != "development" ]; then
  check_group "Required (preview/production)" "${REQUIRED_DEPLOYED[@]}"
else
  echo "-- Required (preview/production only; dev falls back to local sqlite) --"
  for name in "${REQUIRED_DEPLOYED[@]}"; do
    if present "$name"; then
      echo "  OK      $name (set locally too)"
    else
      echo "  --      $name (not required for development)"
    fi
  done
fi
check_group "Required for web-search / Work / feature flags" "${REQUIRED_FEATURES[@]}"

echo "-- Optional --"
for name in "${OPTIONAL[@]}"; do
  if present "$name"; then
    echo "  OK      $name"
  else
    echo "  --      $name (not set, has a code default or is platform-injected)"
  fi
done

echo
if [ "$missing_required" -eq 1 ]; then
  echo "RESULT: missing required vars for $ENVIRONMENT — see MISSING lines above."
  exit 1
fi
echo "RESULT: all required vars present for $ENVIRONMENT."
