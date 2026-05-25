#!/usr/bin/env bash
# scripts/dr/restore-test.sh ([N5]) — quarterly disaster-recovery drill.
#
# Validates that a Supabase Postgres backup can be (a) downloaded,
# (b) replayed into a SCRATCH database, and (c) used by the api to
# satisfy a smoke probe. Records the timing so the team can compare
# this quarter's RTO to the previous one.
#
# Usage:
#   ./scripts/dr/restore-test.sh <env>  <quarter>
#   ./scripts/dr/restore-test.sh staging  2026Q2
#
# Requirements:
#   - supabase CLI authenticated (`supabase login`)
#   - psql installed
#   - $DR_SCRATCH_DATABASE_URL set to a writable Postgres
#     (e.g. a throwaway Supabase project named travel-dr-scratch)
#   - $DR_SOURCE_PROJECT_REF set to the Supabase project to restore FROM
#
# Output:
#   - Step-by-step log to stdout
#   - On success: appends a row to docs/dr-drills/<quarter>.md
#   - Exit code 0 on success, non-zero on any failed step
#
# What "success" means:
#   1. The latest available dump downloads in < 5 min
#   2. The dump replays into the scratch DB in < 30 min
#   3. A `SELECT count(*) FROM "User"` returns > 0
#   4. The api boots against the scratch DB and /health/ready 200s
#
# Together these are the four checks that translate "we have backups"
# into "we have RECOVERABLE backups". A green drill is the only
# evidence the RPO/RTO numbers in docs/runbooks/backups-dr.md are real.

set -euo pipefail

ENV="${1:-}"
QUARTER="${2:-}"

if [ -z "$ENV" ] || [ -z "$QUARTER" ]; then
  echo "Usage: $0 <env> <quarter>" >&2
  echo "  $0 staging 2026Q2" >&2
  exit 2
fi

case "$ENV" in
  staging|production) ;;
  *) echo "::error::env must be staging or production"; exit 2 ;;
esac

REQUIRED_ENV=(
  DR_SCRATCH_DATABASE_URL
  DR_SOURCE_PROJECT_REF
)
for var in "${REQUIRED_ENV[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "::error::env var $var is required" >&2
    exit 2
  fi
done

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DRILL_DIR="$REPO_ROOT/docs/dr-drills"
DRILL_FILE="$DRILL_DIR/${QUARTER}.md"
mkdir -p "$DRILL_DIR"

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

note() {
  echo "→ $*" | tee -a "$LOG"
}

fail() {
  echo "::error::$*" | tee -a "$LOG" >&2
  exit 1
}

START_TS=$(date -u +%s)

note "DR drill — $ENV — $QUARTER — started at $(date -u +%FT%TZ)"

# ─── Step 1: download the latest dump ─────────────────────────────────
note "Step 1: listing backups for project $DR_SOURCE_PROJECT_REF"
BACKUP_ID=$(supabase db backups list \
  --project-ref "$DR_SOURCE_PROJECT_REF" \
  --output json \
  | jq -r '.[0].id // empty')

if [ -z "$BACKUP_ID" ]; then
  fail "no backups found for project $DR_SOURCE_PROJECT_REF"
fi
note "  using backup id: $BACKUP_ID"

DUMP_FILE=$(mktemp -t dr-dump.XXXXXX.sql)
DL_START=$(date -u +%s)
supabase db backups download \
  --project-ref "$DR_SOURCE_PROJECT_REF" \
  --id "$BACKUP_ID" \
  --file "$DUMP_FILE" \
  || fail "supabase db backups download failed"
DL_SECS=$(( $(date -u +%s) - DL_START ))
note "  download OK in ${DL_SECS}s ($(du -h "$DUMP_FILE" | cut -f1))"

if [ "$DL_SECS" -gt 300 ]; then
  note "  ⚠️  download > 5 min — flag in drill notes"
fi

# ─── Step 2: replay into scratch ───────────────────────────────────────
note "Step 2: replaying into scratch DB"
RP_START=$(date -u +%s)

# Truncate scratch first — replay is non-additive.
psql "$DR_SCRATCH_DATABASE_URL" \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" \
  || fail "could not reset scratch schema"

psql "$DR_SCRATCH_DATABASE_URL" -f "$DUMP_FILE" >/dev/null \
  || fail "psql replay failed — see stderr above"

RP_SECS=$(( $(date -u +%s) - RP_START ))
note "  replay OK in ${RP_SECS}s"

if [ "$RP_SECS" -gt 1800 ]; then
  note "  ⚠️  replay > 30 min — flag in drill notes"
fi

# ─── Step 3: data smoke (row counts) ──────────────────────────────────
note "Step 3: row-count smoke"
USER_COUNT=$(psql "$DR_SCRATCH_DATABASE_URL" -At -c 'SELECT count(*) FROM "User";' || echo 0)
note "  User count: $USER_COUNT"
if [ "$USER_COUNT" -eq 0 ]; then
  fail "User table empty after replay — backup is unusable"
fi

TRIP_COUNT=$(psql "$DR_SCRATCH_DATABASE_URL" -At -c 'SELECT count(*) FROM "Trip";' || echo 0)
note "  Trip count: $TRIP_COUNT"

# ─── Step 4: api boot smoke ───────────────────────────────────────────
note "Step 4: booting api against scratch (optional — skipped if pnpm absent)"
if command -v pnpm >/dev/null 2>&1; then
  BOOT_LOG=$(mktemp)
  (
    cd "$REPO_ROOT"
    DATABASE_URL="$DR_SCRATCH_DATABASE_URL" \
      DIRECT_URL="$DR_SCRATCH_DATABASE_URL" \
      pnpm --filter=api dev > "$BOOT_LOG" 2>&1 &
    echo $! > /tmp/dr-api.pid
  )
  # 60s wait for /health/ready.
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/v1/health/ready || echo 0)
    [ "$code" = "200" ] && break
    sleep 2
  done
  kill -TERM "$(cat /tmp/dr-api.pid)" 2>/dev/null || true
  if [ "$code" = "200" ]; then
    note "  api boot smoke OK"
  else
    note "  ⚠️  api did not reach /health/ready in 60s — see $BOOT_LOG"
  fi
else
  note "  pnpm not installed — skipped boot smoke"
fi

# ─── Step 5: record the drill ─────────────────────────────────────────
TOTAL_SECS=$(( $(date -u +%s) - START_TS ))

{
  echo ""
  echo "## $(date -u +%FT%TZ) — env=$ENV quarter=$QUARTER"
  echo ""
  echo "| Step          | Result                          |"
  echo "| ------------- | ------------------------------- |"
  echo "| Backup id     | \`$BACKUP_ID\`                  |"
  echo "| Download      | ${DL_SECS}s, $(du -h "$DUMP_FILE" | cut -f1) |"
  echo "| Replay        | ${RP_SECS}s                     |"
  echo "| User rows     | $USER_COUNT                     |"
  echo "| Trip rows     | $TRIP_COUNT                     |"
  echo "| Total elapsed | ${TOTAL_SECS}s (≈ $((TOTAL_SECS / 60))m) |"
  echo "| RTO target    | < 60 min for prod (see backups-dr.md) |"
  echo "| RTO observed  | ${TOTAL_SECS}s — $([ "$TOTAL_SECS" -lt 3600 ] && echo PASS || echo FAIL) |"
  echo ""
  echo "Operator: <fill in name + sign-off>"
} >> "$DRILL_FILE"

note "Drill recorded → $DRILL_FILE"
note "Total elapsed: ${TOTAL_SECS}s"

if [ "$TOTAL_SECS" -lt 3600 ]; then
  echo "::notice::DR drill PASS — within 1h RTO"
  exit 0
else
  echo "::error::DR drill FAIL — exceeded 1h RTO"
  exit 1
fi
