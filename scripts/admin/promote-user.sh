#!/usr/bin/env bash
# scripts/admin/promote-user.sh — promote a user to role='admin'.
#
# This is the operator-owed bootstrap path the Z2 audit flagged: today
# promoting an admin requires opening Prisma Studio or running raw SQL
# by hand. This script fills both gaps:
#   - takes an email + an actor-name (the operator running it)
#   - flips User.role to 'admin' in a transaction
#   - writes an AdminAuditLog row attributing the promotion
#
# Usage:
#
#   DATABASE_URL=postgres://... \
#     ./scripts/admin/promote-user.sh user@example.com "alice@team"
#
# Required env:
#   DATABASE_URL   — postgres URL. Use DIRECT_URL (not the pgbouncer
#                    pooler) so transactional SET LOCAL works.
#
# Args:
#   $1  target user email (must already exist in the User table)
#   $2  operator handle / name for the audit-log context (e.g. 'alice@team')
#
# Honest framing: this is an out-of-band bootstrap path. The operator
# already has DATABASE_URL; the audit row trusts that the operator
# acted in good faith. Two-approver flow happens in your secrets-management
# layer (Doppler / 1Password), not here.
#
# Installed by [S-E2] of the S-series real-functionality closeout.

set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

EMAIL="${1:?usage: promote-user.sh <email> <operator-handle>}"
OPERATOR="${2:?usage: promote-user.sh <email> <operator-handle>}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FATAL: DATABASE_URL must be set (use DIRECT_URL, not the pooler)." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "FATAL: psql is required. Install postgresql-client." >&2
  exit 2
fi

# Reject pgbouncer URLs early — transactional UPDATE + INSERT inside a
# single tx needs the direct connection.
if [[ "$DATABASE_URL" == *"pgbouncer=true"* ]]; then
  echo "FATAL: DATABASE_URL points at the pgbouncer pooler. Use DIRECT_URL." >&2
  exit 2
fi

# Sanity-check the target exists. We do this in a separate query rather
# than relying on UPDATE's affected-row count so the failure mode is
# clearer ("user not found" vs "no rows updated").
USER_ID=$(psql "$DATABASE_URL" -Atc \
  "SELECT id FROM \"User\" WHERE email = '$(echo "$EMAIL" | sed "s/'/''/g")' LIMIT 1;")
if [[ -z "$USER_ID" ]]; then
  echo "FATAL: no User row found with email = $EMAIL" >&2
  exit 3
fi
echo "Found target user id: $USER_ID"

# The transaction. We use $$DOLLAR$$ quoting on the JSON literal so the
# operator-handle can carry punctuation without further shell quoting.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

-- Capture the old role for the audit row.
WITH old AS (
  SELECT role FROM "User" WHERE id = '$USER_ID' FOR UPDATE
)
UPDATE "User"
   SET role = 'admin'
 WHERE id = '$USER_ID';

INSERT INTO "AdminAuditLog" (id, "actorId", "targetType", "targetId", "action", "context", "createdAt")
VALUES (
  -- prisma cuid() is generated app-side; we mint a random-ish text id
  -- via concat. Good enough for a bootstrap row that is never PK-joined
  -- on by anything else.
  'bootstrap_' || encode(gen_random_bytes(16), 'hex'),
  NULL,
  'user',
  '$USER_ID',
  'promote_admin',
  jsonb_build_object(
    'email', '$EMAIL',
    'operator', '$OPERATOR',
    'source', 'scripts/admin/promote-user.sh'
  ),
  now()
);

COMMIT;
SQL

echo "OK: promoted $EMAIL ($USER_ID) to role='admin', audited as operator='$OPERATOR'"
