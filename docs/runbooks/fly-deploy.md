# Runbook: Fly.io deploy

> Installed by prompt `[IV.18.19.11]`. Companion to
> [`fly.toml`](../../fly.toml) +
> [`docs/runbooks/dockerfile.md`](./dockerfile.md) +
> [`docs/runbooks/secrets.md`](./secrets.md).

## TL;DR

```sh
# Once per machine
fly auth login

# Once per environment
fly apps create travel-api-staging
fly secrets import --app travel-api-staging < <(doppler secrets download --no-file --format env --config staging)

# Every deploy
fly deploy --app travel-api-staging
```

## First-time setup

### 1. Install + authenticate

```sh
brew install flyctl   # macOS
# or: curl -L https://fly.io/install.sh | sh

fly auth login
```

### 2. Create the staging app

```sh
fly apps create travel-api-staging --org <your-org-slug>
```

Don't `fly launch` — it would overwrite our hand-tuned `fly.toml`.
The `app` field in `fly.toml` references the name we just created.

### 3. Provision Postgres + Redis (or use external)

Two paths:

**A. Fly's managed Postgres / Upstash Redis** (fastest):

```sh
fly postgres create --name travel-postgres-staging --region iad --vm-size shared-cpu-1x --volume-size 10
fly postgres attach --app travel-api-staging travel-postgres-staging

fly redis create --name travel-redis-staging --region iad --plan free
fly redis status travel-redis-staging   # copy the connection URL
```

**B. External managed services** (Supabase Postgres, Upstash Redis,
R2 for S3): set `DATABASE_URL` / `REDIS_URL` / `S3_*` directly via
Doppler. This is the production-recommended path —
[`memory/project_supabase_database.md`](../../) flags Supabase as
the prod DB; the dev story uses local Postgres for fidelity.

### 4. Inject secrets from Doppler

```sh
# Staging — pulls every secret from the staging config and pushes
# to Fly. fly secrets import is idempotent.
doppler secrets download --no-file --format env --config staging \
  | fly secrets import --app travel-api-staging
```

Verify:

```sh
fly secrets list --app travel-api-staging
```

You should see all 15 required vars from
[`docs/runbooks/env-reference.md`](./env-reference.md).

### 5. Apply Prisma migrations

The image does **NOT** auto-migrate (per `docs/runbooks/dockerfile.md`).
Run migrations as a one-shot before `fly deploy` first time:

```sh
fly machine run \
  --app travel-api-staging \
  --rm \
  registry.fly.io/travel-api-staging:latest \
  /usr/bin/node apps/api/node_modules/prisma/build/index.js migrate deploy
```

(The image must be pushed once before this works — run `fly deploy`
once with the image only, OR push manually via `fly deploy --build-only`.)

### 6. Deploy

```sh
fly deploy --app travel-api-staging
```

`fly deploy`:

1. Builds the image using `apps/api/Dockerfile` (multi-stage; see
   `docs/runbooks/dockerfile.md`).
2. Pushes to Fly's registry.
3. Rolls out a new machine + waits for `/health/ready` to return 200
   before promoting traffic (per `[[http_service.checks]]` in
   `fly.toml`).
4. Drains the old machine via SIGTERM with a 30s grace window
   (matches Nest's `enableShutdownHooks`).

## Day-2 operations

### Tail logs

```sh
fly logs --app travel-api-staging
```

Pino-formatted JSON. Pipe through `jq` for filtering:

```sh
fly logs --app travel-api-staging | jq 'select(.level >= 50)'   # warnings + errors only
```

### Inspect metrics

```sh
fly status --app travel-api-staging
```

For the prom dashboards from `[IV.18.19.2]`, point Grafana at Fly's
internal metrics URL (Fly's `[metrics]` block in `fly.toml` exposes
the same `/metrics` endpoint to Fly's built-in Prometheus scraper).

### Roll back

```sh
fly releases --app travel-api-staging      # find the release id
fly deploy --image registry.fly.io/travel-api-staging:deployment-<id>
```

Or via the dashboard: each release shows a "Revert to this version"
button. Roll-back is a forward deploy of the older image — it
re-issues `/health/ready` checks before promoting traffic, so even
a bad-image rollback is gated.

### Apply a new migration

```sh
# 1. Build + push the new image (without rolling out)
fly deploy --app travel-api-staging --build-only

# 2. Run migrate deploy against the new image
fly machine run \
  --app travel-api-staging \
  --rm \
  registry.fly.io/travel-api-staging:latest \
  /usr/bin/node apps/api/node_modules/prisma/build/index.js migrate deploy

# 3. Roll the deploy
fly deploy --app travel-api-staging
```

The order matters: migrate BEFORE the app sees the new schema.
Backwards-compatible migrations (additive columns, new tables) are
safe; destructive migrations need a multi-deploy expand-contract
flow.

## Production cut-over

When `travel-api-staging` has been stable for the agreed soak
window, cut prod by:

```sh
# Copy the staging fly.toml shape to a prod variant.
cp fly.toml fly.prod.toml

# Override these fields for prod:
#   app = "travel-api-prod"
#   [[vm]] size = "shared-cpu-2x"
#   [http_service] min_machines_running = 2
sed -i 's/travel-api-staging/travel-api-prod/' fly.prod.toml
# (manually tune VM size + min machines)

# Create the prod app + secrets + first deploy.
fly apps create travel-api-prod --org <your-org-slug>
doppler secrets download --no-file --format env --config prod \
  | fly secrets import --app travel-api-prod
fly deploy --app travel-api-prod --config fly.prod.toml
```

Don't run prod without first confirming: ADR-009 (DevOps) +
`docs/runbooks/secrets.md` rotation cadence in place + at least one
on-call rotation defined.

## Common failure modes

| Symptom                                                   | Cause                                         | Fix                                                                      |
| --------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| `fly deploy` succeeds but `/health/ready` fails           | Postgres / Redis env vars missing             | `fly secrets list` + cross-ref `env-reference.md`                        |
| Health check returns 200 but real requests 502            | App bound to `127.0.0.1` instead of `0.0.0.0` | `main.ts` calls `app.listen(env.PORT, '0.0.0.0')` — verify in dist       |
| Boot loop with `EnvValidationError`                       | One required var missing from Doppler         | `doppler secrets --config staging` to compare                            |
| Boot loop with `Cannot find module @prisma/client`        | Builder stage didn't run `db:generate`        | Re-run `pnpm --filter=api db:generate` in builder; rebuild image         |
| Slow first response after `auto_stop_machines` cold start | Fly is spinning up the suspended machine      | Tune `min_machines_running >= 1` in `fly.toml` to keep one warm          |
| Migrate-deploy fails with "no migrations"                 | Wrong image tag                               | Re-run `fly deploy --build-only` to push the latest, then re-run migrate |

## Cross-references

- [`fly.toml`](../../fly.toml) — the actual config
- [`docs/runbooks/dockerfile.md`](./dockerfile.md) — what the image looks like
- [`docs/runbooks/secrets.md`](./secrets.md) — Doppler integration
- [`docs/runbooks/env-reference.md`](./env-reference.md) — every env var
- [ADR-009 — DevOps](../adr/ADR-009-devops.md) — the deploy posture
