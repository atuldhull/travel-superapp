# Load tests

[k6](https://k6.io) load tests for the API. Two postures:

| Script                   | Posture                           | Run when                          |
| ------------------------ | --------------------------------- | --------------------------------- |
| [`smoke.js`](./smoke.js) | 20 VUs · 4 min · p95<500ms        | Every PR (CI `load` job)          |
| _(future)_ `stress.js`   | 200 VUs · 15 min · find the cliff | On-demand via `workflow_dispatch` |
| _(future)_ `soak.js`     | 50 VUs · 30 min · memory growth   | Nightly                           |

`smoke.js` is the only one wired into PR CI today. It catches a 10×
p95 regression on the hot, no-auth endpoints (health, /featured,
/feed/public, /metrics) the moment it lands instead of finding it
from a customer ticket.

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
