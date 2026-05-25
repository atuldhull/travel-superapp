#!/usr/bin/env bash
# scripts/secrets/rotate-jwt-keyring.sh ([N6]) — rotate the
# `JwtKeyringStore`-managed JWT signing keys without re-deploying.
#
# Why this script + not just `fly secrets set`: the env-var path
# replaces the bootstrap secret, but the api's `RedisJwtKeyringStore`
# caches the active ring in Redis for 30s. The proper rotation
# rotates the RING (current → previous, mint a fresh current),
# preserving the previous key so in-flight tokens still verify
# until they expire naturally. That's an in-app operation, not an
# env-var swap.
#
# Usage:
#   ./scripts/secrets/rotate-jwt-keyring.sh staging access
#   ./scripts/secrets/rotate-jwt-keyring.sh prod    refresh
#
# Requires:
#   $ADMIN_TOKEN_<env>   admin-role bearer token for the target env
#   $BASE_URL_<env>      e.g. https://travel-api-staging.fly.dev
#
# Calls the admin rotate endpoint (registered in identity.module by
# [III.13.2.8]) which:
#   1. Reads the current ring from Redis
#   2. Mints a fresh 32-byte secret + kid
#   3. Moves the existing `current` to `previous[0]`
#   4. Writes the new ring atomically
#   5. Invalidates the in-process cache
#
# Tokens issued before the rotation continue to verify against
# `previous[0]` for up to one access-token TTL (15m). After 15m,
# any client still holding pre-rotation tokens hits 401 and refreshes.
#
# Drill:
#   1. Run this script against staging on day 0.
#   2. Watch the `/refresh` traffic over the next 30m — should see
#      a small bump as clients pick up the new kid.
#   3. Look at `jwt_keyring_rotated` log line — confirm new kid.
#   4. Wait 16m, run again. Now previous = day-0's current; the
#      day-0 kid is on the way out.

set -euo pipefail

ENV="${1:-}"
RING="${2:-}"

if [ -z "$ENV" ] || [ -z "$RING" ]; then
  echo "Usage: $0 <staging|prod> <access|refresh>" >&2
  exit 2
fi

case "$ENV" in
  staging|prod) ;;
  *) echo "::error::env must be 'staging' or 'prod'"; exit 2 ;;
esac

case "$RING" in
  access|refresh) ;;
  *) echo "::error::ring must be 'access' or 'refresh'"; exit 2 ;;
esac

# Resolve env-specific config from the shell env. The CI workflow
# under .github/workflows/secret-rotation.yml hydrates these from
# Doppler before calling this script.
if [ "$ENV" = "staging" ]; then
  TOKEN="${ADMIN_TOKEN_STAGING:-}"
  BASE_URL="${BASE_URL_STAGING:-https://travel-api-staging.fly.dev}"
else
  TOKEN="${ADMIN_TOKEN_PROD:-}"
  BASE_URL="${BASE_URL_PROD:-https://travel-api-prod.fly.dev}"
fi

if [ -z "$TOKEN" ]; then
  echo "::error::admin token not set for env=$ENV (expected ADMIN_TOKEN_${ENV^^})" >&2
  exit 1
fi

echo "→ rotating $RING ring on $ENV ($BASE_URL)"

response=$(curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -w '\n%{http_code}' \
  "$BASE_URL/api/v1/admin/jwt-keyring/$RING/rotate")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -ne 200 ]; then
  echo "::error::rotate failed (HTTP $http_code): $body" >&2
  exit 1
fi

new_kid=$(echo "$body" | jq -r '.currentKid // empty')
prev_count=$(echo "$body" | jq -r '.previousCount // 0')

echo "  ✓ rotated. new currentKid=$new_kid, previousCount=$prev_count"
echo "  next step: wait ≥ access-token TTL (15m) before rotating again"
