# Runbook — Worker deploys

> **Installed by [Q4]** of the Scale-readiness 3→10 series. Companion to [fly-deploy.md](fly-deploy.md) (the api equivalent) + [`packages/jobs/README.md`](../../packages/jobs/README.md) (the queue contracts).

Three Node workers ship as independent Fly apps, one per logical pipeline:

| App                            | Source dir                  | Queue             | Reads from                           |
| ------------------------------ | --------------------------- | ----------------- | ------------------------------------ |
| `travel-notification-worker-*` | `apps/notification-worker/` | `notifications`   | Redis · Resend · Twilio · web-push   |
| `travel-media-service-*`       | `apps/media-service/`       | `media-variants`  | Redis · R2 · Postgres (state update) |
| `travel-crawler-worker-*`      | `apps/crawler-worker/`      | `crawler-recrawl` | Redis · Google Places · FSQ · OSM    |

`*` = `staging` or `prod`. The ai-service (Python) deploys separately — see [ai-inference-scale.md](../architecture/ai-inference-scale.md) ([Q10]).

## One-time setup (operator-owed)

```sh
# Per environment, per worker — once.
flyctl apps create -o <fly-org> travel-notification-worker-staging
flyctl apps create -o <fly-org> travel-notification-worker-prod
flyctl apps create -o <fly-org> travel-media-service-staging
flyctl apps create -o <fly-org> travel-media-service-prod
flyctl apps create -o <fly-org> travel-crawler-worker-staging
flyctl apps create -o <fly-org> travel-crawler-worker-prod
```

Then prime the secrets on each app — workers need `REDIS_URL` minimum:

```sh
flyctl secrets import -a travel-notification-worker-staging < .doppler/staging.env
# ... repeat for every (worker, env) pair
```

`FLY_API_TOKEN` repo secret must have deploy scope on every worker app (one personal token works; an org token is cleaner for prod).

## Day-to-day — automated deploys

`.github/workflows/deploy-workers.yml` deploys on push to `main` that touches:

- `apps/<worker>/**`
- `packages/jobs/**` or `packages/logger/**` (shared deps)
- `pnpm-lock.yaml` (toolchain changes)

A `dorny/paths-filter@v3` step computes WHICH workers changed; only those run `flyctl deploy`. So a notification-worker PR doesn't redeploy media or crawler.

## Manual deploy

```sh
# Staging — fastest signal
flyctl deploy \
  --config apps/notification-worker/fly.toml \
  --app travel-notification-worker-staging \
  --dockerfile apps/notification-worker/Dockerfile \
  --remote-only

# Production
flyctl deploy \
  --config apps/notification-worker/fly.toml \
  --app travel-notification-worker-prod \
  --dockerfile apps/notification-worker/Dockerfile \
  --remote-only
```

Or via the GitHub Actions UI: **Actions → deploy-workers → Run workflow → pick worker + environment**.

## Scaling

Workers run as `[processes]` machines — no `auto_stop_machines` (pausing mid-drain would lose jobs). Scale manually:

```sh
flyctl scale count 3 -a travel-notification-worker-prod
flyctl scale count 1 -a travel-crawler-worker-prod   # crawler is rate-limited upstream; keep low
```

`WORKER_CONCURRENCY` (set in each fly.toml `[env]`) controls per-process concurrency. Bumping it = each machine pulls more jobs in parallel; bumping the machine count = horizontal scale. Combined: `total_in_flight = WORKER_CONCURRENCY × machine_count`.

## Graceful drain

Each worker handles `SIGTERM` / `SIGINT` and calls `worker.close()` from `@app/jobs` — BullMQ finishes in-flight jobs first, then releases the Redis connection. `kill_timeout` in each `fly.toml` is sized for the workload (notification = 60s, media = 120s for Sharp, crawler = 180s for an in-progress fetch).

If `kill_timeout` expires before the worker drains, Fly sends `SIGKILL`. Inflight jobs go back to the queue's `wait` state (BullMQ visibility-timeout reclaim). They retry on the next deploy.

## Triage

### Worker won't start

```sh
flyctl logs -a travel-<name>-worker-staging
```

First line should be `notification-worker booting` (or equivalent). If it's `FATAL: REDIS_URL is required`, the secret didn't propagate — re-import from Doppler.

### Queue not draining

```sh
# Connect to Redis and inspect the queue state.
redis-cli -u $REDIS_URL
> XLEN {notifications}:wait      # pending
> XLEN {notifications}:active    # in-flight
> XLEN {notifications}:failed    # dead-lettered
```

If `wait` keeps growing, scale up workers (`flyctl scale count …`). If `failed` is growing, look at the failure reasons:

```sh
flyctl logs -a travel-<name>-worker-prod | grep '"failed"'
```

Common pattern: a downstream service (Resend, Twilio) is down. The retry policy (5 attempts, exponential backoff) should let things recover when the upstream returns; if it doesn't, the circuit-breaker pattern from [Q2 / O1] kicks in.

### Worker eats too much memory

Sharp + libvips (media-service) is the usual culprit. Bump `memory_mb` in `ops/terraform/workers.tf` and `apps/media-service/fly.toml` to 1024 if a particular image OOMs the 512mb VM. Sharp is also tunable via `concurrency` — drop it to `2` if memory is tighter than CPU.

## See also

- [`packages/jobs/README.md`](../../packages/jobs/README.md) — the typed Queue + Worker contract
- [`docs/runbooks/fly-deploy.md`](fly-deploy.md) — the api deploy story
- [`docs/runbooks/redis-cluster-posture.md`](redis-cluster-posture.md) — what changes when workers move to a cluster
- [`docs/runbooks/database-pooling.md`](database-pooling.md) — when workers start hitting Postgres, count toward the [Q1] pool budget
- [`ops/terraform/workers.tf`](../../ops/terraform/workers.tf) — the Fly resources
- [`.github/workflows/deploy-workers.yml`](../../.github/workflows/deploy-workers.yml) — the deploy pipeline
