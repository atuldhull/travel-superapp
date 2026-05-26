# notification-worker

> **Real worker installed by [Q3]** of the Scale-readiness 3→10 series. Was a placeholder until now; consumes the `notifications` BullMQ queue and routes jobs to push / email / SMS dispatchers.

## What it does today

- Connects to Redis (`REDIS_URL`) via [`@app/jobs`](../../packages/jobs/).
- Consumes the `notifications` queue with default concurrency 10 (override `WORKER_CONCURRENCY`).
- Currently the handler is a **stub** — it logs each job. The real per-channel dispatchers (Resend / Twilio / web-push) still run inline inside `apps/api` and will migrate in a follow-up PR.
- Closes cleanly on `SIGTERM` / `SIGINT` — BullMQ `Worker.close()` finishes in-flight jobs first.

## Run it

```sh
# Local — assumes pnpm dev:up has booted Redis on :6379
pnpm --filter=notification-worker dev

# Production — assumes Doppler-injected REDIS_URL
pnpm --filter=notification-worker build
pnpm --filter=notification-worker start
```

## Env contract

Identical to `apps/api`'s env (validated by [`@app/config`](../../packages/config/) on boot). Only the keys actually consumed:

| Env                  | Required | Notes                                                           |
| -------------------- | -------- | --------------------------------------------------------------- |
| `REDIS_URL`          | ✅       | The queue's backend. Same Redis instance / cluster as apps/api. |
| `LOG_LEVEL`          | —        | Pino level. Default `info`.                                     |
| `NODE_ENV`           | —        | Drives log shape + error sanitisation.                          |
| `WORKER_CONCURRENCY` | —        | Per-process parallelism. Default `10`. Tune per workload.       |

The worker NEVER touches Postgres directly today. When the real dispatchers migrate in, they will inject their own Prisma client; that connection then counts toward the [Q1 pooling budget](../../docs/runbooks/database-pooling.md).

## Deploy posture (Q4 will wire this)

This package has **no Dockerfile / fly.toml yet** — [Q4] adds independently-deployable infra. Until then the worker runs on the same Fly machine as the api (started by a `procfile`).

## See also

- [`packages/jobs/`](../../packages/jobs/) — typed Queue + Worker factories
- [`docs/runbooks/redis-cluster-posture.md`](../../docs/runbooks/redis-cluster-posture.md) — cluster safety
- [`docs/runbooks/database-pooling.md`](../../docs/runbooks/database-pooling.md) — Postgres connection budget once the dispatchers wire up
