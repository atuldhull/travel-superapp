# Runbook — Admin role promotion

> **Installed by [S-E2]** of the S-series real-functionality closeout. Closes the Z2 admin audit's #2 ship-blocker: until now there was no bootstrap path for promoting a user to `role='admin'` — operators ran Prisma Studio or hand-typed SQL, and no audit trail captured WHO did it.

## When this runbook applies

- Granting the first admin on a fresh staging / prod environment.
- Adding a new oncall operator to the admin rotation.
- Restoring admin access after a self-delete or accidental role downgrade.

For any non-bootstrap admin action (banning users, verifying scams, resolving SOS, deleting media, archiving trips) use the in-app admin console at `/admin/*` — those mutations are role-gated + audit-logged by the application code.

## What the script does

[`scripts/admin/promote-user.sh`](../../scripts/admin/promote-user.sh) runs a single Postgres transaction that:

1. Looks up the target user by email; aborts if no row matches.
2. `UPDATE "User" SET role = 'admin' WHERE id = $userId`.
3. `INSERT` into `AdminAuditLog` with `action='promote_admin'`, `targetType='user'`, `context={ email, operator, source }`.
4. Commits — both rows land atomically.

The audit row is the part that closes the audit-log invariant. Every admin action in this codebase MUST leave a row; bootstrap was the one gap.

## Prerequisites

| Requirement            | Why                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bash (Git Bash on Win) | The script is POSIX; runs in Git Bash, WSL, macOS Terminal, Linux shell.                                                                             |
| `psql` on `$PATH`      | Postgres client. On Windows install from postgresql.org or Scoop. On macOS via Homebrew.                                                             |
| `DATABASE_URL` env     | **MUST be the direct URL, NOT the pooler.** Transactional `UPDATE + INSERT` requires a direct connection — pgbouncer transaction mode is unsuitable. |
| Two-approver authority | Out-of-band. Document the approver who signed off in the operator-handle arg (which is preserved verbatim in the audit context).                     |

The script rejects a pgbouncer URL up-front (`pgbouncer=true` in the DSN) — that catch saves the silent-rollback failure mode.

## Usage

```bash
DATABASE_URL="$DIRECT_URL" \
  ./scripts/admin/promote-user.sh user@example.com "alice@team"
```

Two args:

1. **Target email** — must exactly match a `User.email`. Case-sensitive.
2. **Operator handle** — free-form string, recorded in the audit row's `context.operator` field. Convention: `<handle>@team` so it's distinguishable from automated actions.

Successful run looks like:

```
Found target user id: clx1abc123...
BEGIN
UPDATE 1
INSERT 0 1
COMMIT
OK: promoted user@example.com (clx1abc123...) to role='admin', audited as operator='alice@team'
```

## Verifying the promotion

Two checks — one on the `User` table, one on the audit log:

```sql
-- Did the role actually flip?
SELECT id, email, role FROM "User" WHERE email = 'user@example.com';
--  ↳ role should now be 'admin'

-- Is the audit row there?
SELECT id, "actorId", "targetType", "targetId", action, context, "createdAt"
  FROM "AdminAuditLog"
 WHERE action = 'promote_admin'
   AND "targetId" = (SELECT id FROM "User" WHERE email = 'user@example.com')
 ORDER BY "createdAt" DESC
 LIMIT 1;
--  ↳ one row, context JSON includes the email + operator handle
```

The new admin can confirm by visiting `/admin` on the deployed web app and not getting a 403. (Their JWT has to be re-issued — they should log out / log back in to pick up the new claim.)

## Demoting

There's no demote script today. Use plain SQL:

```sql
BEGIN;
UPDATE "User" SET role = 'user' WHERE id = '<userId>';
INSERT INTO "AdminAuditLog" (id, "actorId", "targetType", "targetId", "action", "context", "createdAt")
VALUES (
  'bootstrap_' || encode(gen_random_bytes(16), 'hex'),
  NULL, 'user', '<userId>', 'demote_admin',
  jsonb_build_object('email', '<email>', 'operator', '<your-handle>', 'source', 'manual sql'),
  now()
);
COMMIT;
```

If demote becomes routine, build a `scripts/admin/demote-user.sh` companion — same shape, just the inverse SQL.

## Why no in-app surface?

Memory + the Z2 audit both flagged this: an in-app "promote user" button would mean:

- The first admin can never bootstrap (chicken/egg).
- Every admin can recursively grant admin — blast radius scales badly.
- Audit-trail accountability blurs (two admins each pointing at the other).

Out-of-band bootstrap via this script keeps the trust boundary at the OPERATOR (the person with `$DATABASE_URL`), not the application. That's the same trust model as `flyctl secrets`, `gcloud auth`, and `psql` itself.

A web UI for promoting users may land later **after** the team has more than one admin + an oncall-rotation process. Until then, this runbook is the source of truth.

## Operator checklist

Before running:

- [ ] You have explicit written approval from the org owner (or designated approver) to grant admin to this email.
- [ ] You are on a trusted machine (no shared kiosks, no untrusted networks).
- [ ] `DATABASE_URL` is the **direct** Postgres URL (not the pooler). Verify with `echo "$DATABASE_URL" | grep -q pgbouncer && echo POOLER || echo DIRECT`.
- [ ] You can identify yourself in the operator handle (e.g. `alice@team`, not `admin`).

After running:

- [ ] Verified `User.role = 'admin'` via the SQL above.
- [ ] Verified `AdminAuditLog` row landed.
- [ ] Told the new admin to log out + log back in so their JWT picks up the new claim.
- [ ] Recorded the promotion in the team's secrets-rotation / access-review log (out-of-band).

## See also

- [`scripts/admin/promote-user.sh`](../../scripts/admin/promote-user.sh) — the script itself.
- [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) — `AdminAuditLog` model.
- [`apps/api/src/common/auth/roles.guard.ts`](../../apps/api/src/common/auth/roles.guard.ts) — what the new role unlocks.
- [`apps/web/src/middleware.ts`](../../apps/web/src/middleware.ts) — `ADMIN_IP_ALLOWLIST` middleware (E1) — even with admin role, the operator's IP must be on the allowlist in production.
- [`docs/audit/admin-2026-05-26.md`](../audit/admin-2026-05-26.md) — Z2 admin audit (the audit that flagged this gap).
- [`docs/runbooks/db-partitioning.md`](db-partitioning.md) — yearly partitions for `AdminAuditLog` ≥7yr retention.
