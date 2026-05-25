#!/usr/bin/env bash
# scripts/secrets/rotate-supabase-password.sh ([N6]) — rotate the
# Supabase Postgres password + propagate to Doppler + Fly.
#
# Why semi-automated and not fully automated: Supabase's password
# rotation API requires interactive 2FA from the project owner. The
# script handles the propagation HALF (Doppler → Fly) so the only
# manual step is the Supabase dashboard click. That's by design — a
# fully-automated DB password rotation needs a privileged Supabase
# service token that we don't currently expose to CI.
#
# Workflow:
#
#   1. (manual) Visit Supabase → Project Settings → Database →
#      Reset Database Password. Copy the new password.
#
#   2. (this script) Build the new DATABASE_URL / DIRECT_URL +
#      push to Doppler + push to Fly secrets + restart the app.
#      Smoke-probes the new state before exiting non-zero.
#
# Usage:
#   ./scripts/secrets/rotate-supabase-password.sh staging '<new-password>'
#
# Requires:
#   $DOPPLER_TOKEN              service token with config-write scope
#   $FLY_API_TOKEN              `flyctl tokens create deploy`
#   $SUPABASE_PROJECT_REF_STAGING  / _PROD
#
# Closes the long-standing operator-owed TODO ("rotate Supabase DB pw").
set -euo pipefail

ENV="${1:-}"
NEW_PW="${2:-}"

if [ -z "$ENV" ] || [ -z "$NEW_PW" ]; then
  echo "Usage: $0 <staging|prod> '<new-password>'" >&2
  exit 2
fi

case "$ENV" in
  staging|prod) ;;
  *) echo "::error::env must be 'staging' or 'prod'"; exit 2 ;;
esac

# ─── Resolve env-specific Supabase ref + Fly app ──────────────────────
if [ "$ENV" = "staging" ]; then
  SUPA_REF="${SUPABASE_PROJECT_REF_STAGING:-}"
  FLY_APP="travel-api-staging"
  DOPPLER_CONFIG="staging"
else
  SUPA_REF="${SUPABASE_PROJECT_REF_PROD:-}"
  FLY_APP="travel-api-prod"
  DOPPLER_CONFIG="prod"
fi

if [ -z "$SUPA_REF" ]; then
  echo "::error::SUPABASE_PROJECT_REF_${ENV^^} not set" >&2
  exit 1
fi

# Supabase URLs follow a stable format. The pooled connection goes via
# the supavisor URL (port 6543, transaction mode); migrations go via
# the direct URL (port 5432).
NEW_DB_URL="postgresql://postgres.${SUPA_REF}:${NEW_PW}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
NEW_DIRECT_URL="postgresql://postgres.${SUPA_REF}:${NEW_PW}@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

echo "→ Step 1: push to Doppler config=$DOPPLER_CONFIG"
doppler secrets set DATABASE_URL="$NEW_DB_URL" --config "$DOPPLER_CONFIG" --project travel-api --silent
doppler secrets set DIRECT_URL="$NEW_DIRECT_URL"  --config "$DOPPLER_CONFIG" --project travel-api --silent
echo "  ✓ Doppler updated"

echo "→ Step 2: push to Fly secrets ($FLY_APP)"
fly secrets set \
  --app "$FLY_APP" \
  DATABASE_URL="$NEW_DB_URL" \
  DIRECT_URL="$NEW_DIRECT_URL"
echo "  ✓ Fly updated (machines will restart automatically)"

echo "→ Step 3: wait for rolling restart + smoke /health/ready"
# Fly's `secrets set` triggers a rolling restart. Give the new
# machines 90s to come up, then probe.
sleep 30
BASE_URL=""
if [ "$ENV" = "staging" ]; then
  BASE_URL="${BASE_URL_STAGING:-https://travel-api-staging.fly.dev}"
else
  BASE_URL="${BASE_URL_PROD:-https://travel-api-prod.fly.dev}"
fi

ok=0
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/v1/health/ready" || echo 0)
  if [ "$code" = "200" ]; then ok=1; break; fi
  sleep 2
done

if [ "$ok" -eq 1 ]; then
  echo "  ✓ /health/ready 200 — rotation propagated"
  echo "→ DONE. Remember to revoke the old password on Supabase if not already replaced."
  exit 0
else
  echo "::error::/health/ready did not return 200 within 60s; investigate before assuming success" >&2
  exit 1
fi
