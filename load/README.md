# Load tests

[k6](https://k6.io) load tests for the API. Three postures:

| Script                     | Posture                                     | Run when                                                                 |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| [`smoke.js`](./smoke.js)   | 20 VUs · 4 min · p95<500ms + p99<1000ms     | Every PR (CI `load` job in `ci.yml`)                                     |
| [`stress.js`](./stress.js) | 0→100→200→400 VUs · 13 min · find the cliff | `workflow_dispatch` (manual) in `load-extended.yml`                      |
| [`soak.js`](./soak.js)     | 50 VUs · 70 min · find slow leaks           | Nightly cron at 03:30 UTC (+ `workflow_dispatch`) in `load-extended.yml` |

`smoke.js` is the only PR-gating one. It catches a 10× p99 regression
on the hot, no-auth endpoints (health, /featured, /feed/public,
/metrics) the moment it lands instead of finding it from a customer
ticket. p99 (not just p95) is gated because the review explicitly
called it out — p99 is the tail that defines user-perceived speed.

`stress.js` finds the breaking point — useful before a launch /
marketing push. Run it with the "stress" `workflow_dispatch` input.

`soak.js` is the slow-leak detector. Memory growth, FD exhaustion,
Prisma pool drift, Redis key-space bloat — none of those show up in
a 4-minute smoke. The nightly cron produces a 70-min trend; reviewer
eyeballs the summary artifact for regressions over weeks.

## Run locally

```bash
# Install k6 (one-time): https://k6.io/docs/get-started/installation/
# macOS:    brew install k6
# Windows:  winget install k6
# Linux:    https://k6.io/docs/get-started/installation/#linux

# 1. Boot the API
pnpm dev:up && pnpm --filter=api dev

# 2. Run the smoke
k6 run --env API_BASE=http://localhost:3000 load/smoke.js
```

## SaaS scaffold (k6 Cloud)

The CI job is set up to upload results to [Grafana Cloud k6](https://grafana.com/products/cloud/k6/)
when `K6_CLOUD_TOKEN` is dropped into repo secrets:

```bash
# Opt in by setting the secret in repo Settings → Secrets → Actions.
# The `load` job then runs `k6 cloud` (paid plan) instead of `k6 run`.
```

Inert until the operator provides the token — $0/no-key by default.

## Thresholds

Each threshold in `smoke.js` is a **hard gate**: if it's breached
during the run, k6 exits non-zero and the CI job fails. Tuning a
threshold up to silence a flake is a smell — investigate the
regression first; only relax the threshold with a documented reason.

| Threshold                  | Bar    | Why                                                   |
| -------------------------- | ------ | ----------------------------------------------------- |
| Global p95                 | <500ms | Conservative ceiling across all endpoints             |
| Global error rate          | <1%    | Anything higher is a regression, not noise            |
| `/health/ready` error rate | <0.1%  | Readiness probe must not flap                         |
| `/health/live` p95         | <50ms  | Cheap call; sane bar to spot middleware bloat         |
| `/health/ready` p95        | <150ms | Postgres + Redis ping; bumps signal hot-path slowdown |
| `/metrics` p95             | <100ms | prom-client overhead; sub-100ms expected              |
| `/featured` p95            | <500ms | Postgres + cache; should stay snappy                  |
| `/feed/public` p95         | <500ms | Same posture                                          |
