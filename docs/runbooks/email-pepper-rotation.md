# Runbook — Email pepper rotation (multi-phase migration)

> **Installed by [O4]** to close the TODO in `docs/runbooks/secrets.md`.
> This is a HIGH-RISK procedure. Run only on confirmed compromise of
> `EMAIL_PEPPER`. Routine rotation of this pepper is intentionally
> NOT scheduled — the migration cost outweighs the security benefit
> for a non-compromised value.

## Background

`EMAIL_PEPPER` is used by `apps/api/src/modules/identity/.../email-hash.ts`
to produce a `sha256(pepper + email)` lookup key stored in
`User.hashedEmail`. The pepper protects against an offline DB-only
compromise: an attacker with the table can't run a rainbow-table
attack against `hashedEmail` without also having the pepper.

Rotating the pepper means EVERY existing hashedEmail becomes
invalid — every login by email lookup breaks unless we migrate the
table. This runbook documents the safe multi-phase migration.

## Phases (expand-contract)

```
Phase 1: dual-write    │ writes hash under BOTH peppers
                       │ reads check OLD first, then NEW
                       │ duration: as long as the longest
                       │           tracked refresh-token window
                       │           (30d default)
Phase 2: backfill      │ batch-rewrite every existing hashedEmail
                       │ to the NEW pepper's value
Phase 3: switch read   │ reads check NEW first, then OLD (cleanup)
Phase 4: retire OLD    │ remove dual-write + remove OLD pepper from env
```

### Phase 1 — dual-write

Add a SECOND pepper env var without removing the first:

```bash
# Generate a fresh 32-byte pepper.
NEW_PEPPER=$(openssl rand -hex 32)

# Push to Doppler (don't replace yet).
doppler secrets set EMAIL_PEPPER_NEW="$NEW_PEPPER" --config prod
# Also push to staging.
doppler secrets set EMAIL_PEPPER_NEW="$NEW_PEPPER" --config staging
```

Code changes (one PR):

1. `apps/api/src/modules/identity/.../email-hash.ts` — add
   `emailHashNew(email)` that uses `EMAIL_PEPPER_NEW`.
2. `apps/api/src/modules/identity/.../user.repository.ts` —
   `findByEmailHashOrNew(emailHash, emailHashNew)` reads either.
3. `RegisterUseCase` writes `hashedEmail` (old) AND
   `hashedEmailNew` (new) on every signup.
4. Schema migration (additive): `User.hashedEmailNew String?` +
   unique index `(deletedAt, hashedEmailNew)`.

Deploy via the normal `deploy.yml` chain.

### Phase 2 — backfill

Wait at least one refresh-token TTL (30d) before backfilling — so
EVERY currently-active session has had a chance to use the new
write path on its next operation.

Then run the backfill script:

```bash
# Local dev or `fly ssh console --app travel-api-prod` for one-off:
pnpm --filter=api exec ts-node scripts/backfill-email-pepper.ts \
  --batch-size=1000 \
  --pause-ms=200
```

The script (lands as a one-off, NOT in main branch):

```ts
// scripts/backfill-email-pepper.ts — DO NOT commit; one-time use
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();
const NEW = process.env.EMAIL_PEPPER_NEW!;
const BATCH = parseInt(process.argv[2] ?? '1000', 10);

while (true) {
  const rows = await prisma.user.findMany({
    where: { hashedEmailNew: null, deletedAt: null },
    select: { id: true, email: true },
    take: BATCH,
  });
  if (rows.length === 0) break;
  await prisma.$transaction(
    rows.map((r) =>
      prisma.user.update({
        where: { id: r.id },
        data: {
          hashedEmailNew: createHash('sha256')
            .update(NEW)
            .update(':')
            .update(r.email)
            .digest('hex'),
        },
      }),
    ),
  );
  // 200ms pause keeps DB load civil.
  await new Promise((r) => setTimeout(r, 200));
}
```

Verify count drops to 0:

```sql
SELECT COUNT(*) FROM "User" WHERE "hashedEmailNew" IS NULL AND "deletedAt" IS NULL;
-- Expect: 0
```

### Phase 3 — switch read

Code change: `findByEmailHashOrNew` reads NEW first, OLD second.
The OLD path is now the migration backstop for any rows the
backfill missed (e.g. soft-deleted at runtime mid-backfill).

Deploy normally.

### Phase 4 — retire OLD

After at least ONE more refresh-token TTL (30d) AND
zero "OLD pepper match" log entries for 7 days:

1. Drop the OLD pepper from Doppler + Fly secrets:
   `doppler secrets delete EMAIL_PEPPER --config prod`
2. Remove `EMAIL_PEPPER` from `packages/config/src/schema.ts`.
3. Remove `User.hashedEmail` column (additive migration → ALTER
   TABLE DROP COLUMN, applied via `migrate deploy`).
4. Rename `User.hashedEmailNew` → `hashedEmail` in a follow-up
   migration to avoid the `_New` suffix sticking around forever.

## Rollback at any phase

- After Phase 1, before Phase 2: revert the code change. Both
  hash columns still exist; nothing reads NEW yet.
- After Phase 2 backfill complete: revert Phase 3 deploy. NEW
  column is fully populated but reads check OLD first again.
- After Phase 4: irreversible. The OLD column is dropped + the
  pepper is gone. From here forward the pepper compromise being
  rotated AWAY is also gone — no rollback path.

## Why this is rare

The pepper is a defense-in-depth control, not a primary security
boundary. A compromised pepper alone doesn't unlock user accounts
— the attacker still needs the DB. We rotate ONLY when both have
been compromised + we're rebuilding from a known-clean snapshot.

For routine "I want fresh secrets" energy: rotate JWT keyrings
(quarterly, [N6] script), RATE_LIMIT_PEPPER (annually, single-flip
since it doesn't gate functional flows), and S3 / Doppler /
provider API keys.

## Cross-refs

- [`docs/runbooks/secrets.md`](secrets.md) — the cadence table
- [`docs/security/threat-model.md`](../security/threat-model.md) — where
  the pepper sits in the layered defense
- [`apps/api/src/modules/identity/.../email-hash.ts`](../../apps/api/src/modules/identity/) —
  the implementation (verify the file path; the directory structure
  may change in future refactors)
