# Runbook — Backups + Disaster Recovery

> **Installed by [N5].** RTO/RPO targets and the restore-test
> procedure for Supabase Postgres + Upstash Redis + Cloudflare R2.
> Companion to [supabase-deploy.md](supabase-deploy.md) +
> [`scripts/dr/restore-test.sh`](../../scripts/dr/restore-test.sh).

## RTO / RPO targets

| Asset           | RPO (data loss tolerated) | RTO (downtime tolerated) | Mechanism                                                 |
| --------------- | ------------------------- | ------------------------ | --------------------------------------------------------- |
| Postgres (prod) | **≤ 60 s**                | **≤ 1 h**                | Supabase PITR (paid tier) — continuous WAL archive        |
| Postgres (stg)  | ≤ 24 h                    | ≤ 4 h                    | Daily dump + 14d retention                                |
| Redis (prod)    | ≤ 60 s                    | ≤ 5 min                  | Upstash daily snapshot + WAL — cache, not source of truth |
| Redis (stg)     | NO RPO                    | ≤ 5 min                  | Cache layer; rebuild from source-of-truth on miss         |
| S3 / R2 media   | ≤ 24 h                    | ≤ 1 h                    | R2 versioning + cross-bucket nightly replica              |

RPO = how much data we accept losing. RTO = how long we accept being
down. These are the public commitments tied to the [99.5% availability
SLO](../slos.md). Any incident that breaches both numbers is an
SEV-1 + post-mortem required.

## Backup posture today (what runs automatically)

### Supabase Postgres

- **Daily logical dump** (Supabase free tier baseline) — last 7 days
  retained.
- **Point-in-Time Recovery (PITR)** — REQUIRES paid plan (Pro tier
  $25/mo). When enabled, WAL is archived continuously, giving the
  60s RPO above. Without it, RPO = "last completed daily dump" =
  24h. **The PITR upgrade is operator-owed and listed below.**
- **Manual export** any time:

  ```bash
  # Run from a laptop — never from CI without scrubbing the output.
  supabase db dump --db-url "$DIRECT_URL" --file backup-$(date +%F).sql
  ```

### Upstash Redis

- **Daily snapshot** (free tier) — last 7 days retained.
- **Append-only file (AOF)** — every command persisted. RPO ≤ 1s
  inside the snapshot window.
- Redis is a CACHE in our architecture (not source of truth), so
  the only loss path is "rebuild cache after restore" — measured
  by [cache-collapse runbook](cache-collapse.md).

### S3 / R2 media

- **Versioning enabled** on the prod bucket — accidental deletes
  recoverable for 30 days.
- **Cross-bucket replica** lives at `travel-media-prod-replica`
  in a different R2 region. Nightly cron via a Cloudflare Worker
  (lands in [N11]). Until then, manually sync once a week:

  ```bash
  rclone sync r2:travel-media-prod r2:travel-media-prod-replica --progress
  ```

## Restore procedure

### Tier 1: Postgres point-in-time restore (PITR)

```bash
# Step 1: identify the target timestamp (the moment BEFORE the
# bad write).
target='2026-05-25 14:31:00 UTC'

# Step 2: in Supabase dashboard → Database → Backups → PITR,
# select that timestamp, click "Restore". Supabase provisions a
# NEW project at that point — your existing prod app stays up.
#
# Step 3: copy the new project's DATABASE_URL.
# Step 4: rehydrate Fly secrets:
fly secrets set --app travel-api-prod \
  DATABASE_URL='<new-pitr-url>' \
  DIRECT_URL='<new-pitr-url>'
fly deploy --app travel-api-prod --image registry.fly.io/travel-api-prod:latest
#
# RTO measured: ~10 min Supabase + ~3 min Fly = ~13 min.
```

### Tier 2: dump-and-replay (no PITR available)

```bash
# Step 1: list available dumps.
supabase db backups list --project-ref <your-project>

# Step 2: download the chosen dump.
supabase db backups download --project-ref <your-project> --id <backup-id> \
  --file restore.sql

# Step 3: provision a fresh database (NEW Supabase project) — never
# restore over the live one during an incident.
supabase projects create travel-api-restore-<timestamp> --region us-east-1
# Capture the new DIRECT_URL.

# Step 4: replay.
psql "$NEW_DIRECT_URL" -f restore.sql

# Step 5: cut traffic over (same as PITR step 4).
```

**Data loss window:** up to 24h since the last dump. Communicate to
users on the status page.

### Tier 3: bare-metal Postgres (last resort)

If Supabase itself is down + no backup is downloadable:

1. Spin up a Postgres on Fly: `fly postgres create --name travel-postgres-dr --region iad`.
2. Apply the schema: `pnpm --filter=api run db:migrate:deploy` against the new instance.
3. Replay events from the audit log (search for `domain_events_total{event="…"}` traffic and recreate from Sentry/Honeycomb).
4. Mark the period as "data partial" on the status page and ask
   users to re-enter critical actions (memory-book publishes
   only — most domain state is reconstructable from idempotent
   ingestion).

Tier 3 RTO is "hours-to-days". This is the path we DO NOT want to
exercise; the upgrade to paid Supabase PITR ($25/mo) is the safest
$25/mo we spend.

## Quarterly restore drill

A backup that hasn't been tested is a wish, not a backup. Every
quarter the on-call:

1. Downloads the latest dump from Supabase → Database → Backups.
   (Supabase's CLI has no stable `db backups download` subcommand,
   so this step stays manual — see the script header for the why.)
2. Runs the harness against the downloaded file:

```bash
export DR_DUMP_FILE=/path/to/downloaded/backup.sql
export DR_SCRATCH_DATABASE_URL=postgresql://... # a SEPARATE scratch project
./scripts/dr/restore-test.sh staging 2026Q2
```

(See the script header for what it does + the success criteria.)

The drill writes to `docs/dr-drills/<quarter>.md` — append the
output of the script + sign off. Missed quarter = SEV-2 + filed
as a tracking issue.

## What's operator-owed (TODOs for the human)

1. **Upgrade Supabase to Pro** ($25/mo) → enables PITR; drops the
   Postgres RPO from 24h to 60s.
2. **Set the R2 cross-bucket replica** worker (lands in [N11]'s
   Cloudflare Worker pass).
3. **Run the FIRST restore drill** with `scripts/dr/restore-test.sh
staging Q1` to validate the procedure end-to-end against a real
   Supabase staging snapshot. Until done, the RPO numbers above
   are aspirational.

## Cross-refs

- [docs/runbooks/supabase-deploy.md](supabase-deploy.md) — DB lifecycle
- [docs/runbooks/slo-availability.md](slo-availability.md) — the pager that fires when the DB is gone
- [docs/runbooks/incident-response.md](incident-response.md) — IC/comms template
- [scripts/dr/restore-test.sh](../../scripts/dr/restore-test.sh) — the drill harness
