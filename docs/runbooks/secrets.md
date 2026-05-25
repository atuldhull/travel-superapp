# Runbook: secrets management

> Installed by prompt `[IV.18.19.8]`. Companion to
> [`docs/runbooks/env-reference.md`](./env-reference.md) which
> documents every individual env var.

## TL;DR

- **Source of truth:** [Doppler](https://doppler.com).
- **Never** commit `.env*` files. The `.dockerignore` and `.gitignore`
  are belt-and-braces; the rule is "real secret values never touch
  the repo".
- **Rotation cadence:** quarterly for routine secrets; immediately on
  any leak / employee departure.
- **Automation:** [.github/workflows/secret-rotation.yml](../../.github/workflows/secret-rotation.yml) opens a tracking issue every 90 days with a checklist + one-click commands ([N6]).
- **Breakglass:** see [Breakglass](#breakglass) below for what to do
  when Doppler itself is unreachable.

## Automated rotation tooling ([N6])

Two scripts under [`scripts/secrets/`](../../scripts/secrets/) handle
the propagation half of rotation:

| Script                        | Rotates                       | One-line                                                    |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------- |
| `rotate-jwt-keyring.sh`       | JWT_ACCESS / JWT_REFRESH ring | `./scripts/secrets/rotate-jwt-keyring.sh staging access`    |
| `rotate-supabase-password.sh` | Supabase Postgres password    | `./scripts/secrets/rotate-supabase-password.sh prod '<pw>'` |

`rotate-jwt-keyring.sh` calls the admin endpoint that the
`RedisJwtKeyringStore` exposes: it moves `current` → `previous[0]`
and mints a fresh `current` ATOMICALLY. Tokens issued with the old
kid continue to verify for one access-token TTL (15m); after that,
clients refresh and pick up the new kid. No re-login storm.

`rotate-supabase-password.sh` is semi-automated — the Supabase
2FA-gated password change stays manual (operator clicks
"Reset Database Password" in the dashboard, copies the new pw),
then the script:

1. Pushes the new DATABASE_URL / DIRECT_URL to Doppler
2. Pushes the same to Fly secrets (triggers rolling restart)
3. Smoke-probes /health/ready before exiting

This closes the long-standing "rotate Supabase DB pw (manual TODO)"
note in the road-to-10 review.

`.github/workflows/secret-rotation.yml` runs every 90 days + opens
a tracking issue with the rotation checklist. The on-call closes
the issue once each rotation has been recorded.

## Architecture

```
                ┌─────────────────────────────┐
                │ Doppler workplace           │
                │   ├─ project: travel-api    │
                │   │    ├─ config: dev       │
                │   │    ├─ config: staging   │
                │   │    └─ config: prod      │
                │   ├─ project: notif-worker  │
                │   └─ project: crawler       │
                └────────────┬────────────────┘
                             │ doppler CLI / SDK
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ local dev │         │ staging  │         │   prod   │
  │ (laptop)  │         │  Fly.io  │         │  Fly.io  │
  └──────────┘         └──────────┘         └──────────┘
```

Each environment is a separate Doppler **config** under one
**project**. The `prod` config has the smallest access set; staging
is broader; dev is broadest (but still contains real-shape secrets,
not test values, so dev exercises the same code paths as prod).

## Bootstrap a new dev laptop

```sh
# Install the Doppler CLI.
brew install dopplerhq/cli/doppler   # macOS
# or: curl -Ls https://cli.doppler.com/install.sh | sh

# Authenticate against the workplace (browser flow).
doppler login

# Bind this checkout to the dev config of travel-api.
cd /path/to/travel-superapp
doppler setup --project travel-api --config dev

# Verify the binding.
doppler secrets --only-names
```

After `doppler setup`, the CLI remembers the binding via
`.doppler.yaml` (which IS committed — it contains no secrets, only
the project + config names).

## Run the API locally with injected secrets

```sh
# Boot Postgres / Redis / MinIO via docker compose first.
docker compose -f infra/docker-compose.yml up -d

# Run the API with Doppler injecting every env var.
doppler run -- pnpm --filter=api dev
```

`doppler run` shells out + injects secrets as environment variables;
no values touch disk.

## Run integration tests against the dev config

```sh
doppler run --config dev -- pnpm --filter=api test
```

The test setup (`apps/api/test/setup.ts`) expects the same env vars
as a real run; Doppler ensures they're present + valid.

## Per-environment injection

| Environment                         | Where it runs                   | How secrets land                                                                                                                                                |
| ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local dev                           | Engineer laptop                 | `doppler run`                                                                                                                                                   |
| CI (`ci.yml` + `phase-0-smoke.yml`) | GitHub runners                  | Hard-coded in YAML — these are non-secret CI placeholders, not Doppler-sourced. Change ONLY by editing the workflow file.                                       |
| Preview (per-PR Fly.io)             | Fly.io app                      | `doppler secrets download --no-file --format env > .env && fly deploy` (sets every var in `--env-file`) — temporary; the deploy step deletes the file post-push |
| Staging                             | Fly.io app `travel-api-staging` | Doppler ↔ Fly.io integration: `doppler integrations setup` once + autosync on Doppler changes                                                                   |
| Prod                                | Fly.io app `travel-api-prod`    | Same Doppler ↔ Fly.io integration; staging changes are dry-runs that get reviewed before the prod sync                                                          |

## Rotation cadence

| Secret                                          | Cadence                                     | Why                                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`                             | Quarterly + on incident                     | Issued tokens are short-lived (15m); rotation invalidates outstanding access tokens within ~1 turn of the access window.                                                                                      |
| `JWT_REFRESH_SECRET`                            | Quarterly + on incident                     | Refresh tokens last 30d; rotation requires every user to re-login. Schedule before low-traffic window.                                                                                                        |
| `RATE_LIMIT_PEPPER`                             | Annually + on incident                      | Hashing pepper for IP-based rate buckets. Rotation flushes existing buckets — clients see one cycle of free retries. Acceptable.                                                                              |
| `EMAIL_PEPPER`                                  | NEVER routine; only on incident             | Used for sha256-hashed email lookups. Rotation requires a multi-phase migration (dual-write, backfill, retire). The runbook for the rotation itself lives at `docs/runbooks/email-pepper-rotation.md` (TODO). |
| `BACKUP_CODE_PEPPER`                            | NEVER routine; only on incident             | Rotating invalidates every outstanding MFA backup code. Plan a re-generation flow before rotating.                                                                                                            |
| OAuth `*_CLIENT_SECRET`                         | Annually + on provider notification         | Provider dashboards typically warn ~30 days before deprecating older client secrets.                                                                                                                          |
| `STRIPE_*`                                      | On Stripe-recommended cadence + on incident | Stripe gives 7-day overlap windows; use it.                                                                                                                                                                   |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`               | Quarterly + on incident                     | If S3 = R2 in prod, rotate IAM-style via the R2 dashboard.                                                                                                                                                    |
| API keys (Google Places, Foursquare, Mapbox, …) | Per provider's recommended cadence          | Most providers recommend semi-annual; rotate sooner if billing alerts fire.                                                                                                                                   |

## Rotating a routine secret (JWT example)

The general rotation flow when both old + new can be valid simultaneously:

1. Generate the new value (`openssl rand -hex 32`).
2. Add it as `JWT_ACCESS_SECRET_NEXT` in Doppler (the code currently
   reads only `JWT_ACCESS_SECRET`; the dual-read variant is a future
   enhancement — for now plan a brief restart window).
3. Promote: rename `JWT_ACCESS_SECRET` → `JWT_ACCESS_SECRET_OLD`,
   then rename `JWT_ACCESS_SECRET_NEXT` → `JWT_ACCESS_SECRET`.
4. Deploy. Outstanding 15-minute access tokens fail; clients retry
   the refresh flow with their refresh token (still valid against
   `JWT_REFRESH_SECRET`).
5. After 30 minutes (2× access TTL): delete `JWT_ACCESS_SECRET_OLD`.

For `JWT_REFRESH_SECRET` rotation, replace step 4's "clients retry
the refresh flow" with "clients re-login" — there's no overlap
window since the refresh token IS what the secret signs.

## Rotating a hashing pepper (PII-impacting)

`EMAIL_PEPPER` and `BACKUP_CODE_PEPPER` are hash inputs. Rotating
the pepper invalidates every existing hash. The migration is:

1. Add `EMAIL_PEPPER_NEXT` in Doppler.
2. Code change: dual-hash on read (look up by old hash, fall back
   to new hash). Deploy.
3. Backfill: rehash every row with the new pepper. Run as a
   batched migration; emit progress to ops.
4. Code change: drop the old-hash fallback. Deploy.
5. Delete `EMAIL_PEPPER`; rename `EMAIL_PEPPER_NEXT` → `EMAIL_PEPPER`.

Plan ~1-2 weeks for this migration. Don't do it on a deploy-Friday.

## Breakglass

When Doppler itself is unreachable AND we need to deploy:

1. Pull the most recent `doppler secrets download --no-file --format json`
   that ops keeps in a 1Password vault. (TODO: schedule a weekly
   automated dump into that vault.)
2. Use `--env-file` mode for that single deploy.
3. Open an incident; restore Doppler binding ASAP. Don't ship
   another `--env-file` deploy after the first.

If we suspect a leak: assume the secret IS leaked, rotate
immediately following the appropriate cadence above, and log the
incident in `docs/incidents/`.

## What is NOT a secret

- The `DATABASE_URL` connection string is _secret-shaped_ but in
  practice the password component is the actual secret. Treat the
  whole URL as secret in Doppler; a leaked URL with the password
  blanked is still useful information for an attacker.
- `MEILI_HOST` (URL only) is not secret; `MEILI_MASTER_KEY` is.
- `S3_BUCKET` is not secret; the `S3_*_KEY` pair is.
- `OTEL_EXPORTER_OTLP_ENDPOINT` is typically a private VPC URL —
  not a secret in the cryptographic sense, but treat as need-to-know.

## Cross-references

- [`docs/runbooks/env-reference.md`](./env-reference.md) — every env
  var with its required-vs-optional + what-it-does
- [`packages/config/src/schema.ts`](../../packages/config/src/schema.ts)
  — the source-of-truth Zod schema
- [`CLAUDE.md`](../../CLAUDE.md) — section "no secrets" rule (rule 5)
- ADR-009 (DevOps) — overall infra posture
