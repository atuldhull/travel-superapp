# k6 load-test scaffold

> Installed by prompt `[IV.18.19.5]`. See playbook §10 (Testing pyramid — k6 nightly load).

Two scripts, one purpose: catch latency / throughput regressions
before they ship to users.

## Scripts

| Script                                   | When to run                       | Profile                  | Asserts                                                                                  |
| ---------------------------------------- | --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| [`scripts/smoke.js`](./scripts/smoke.js) | Every deploy. CI/CD gate.         | 1 VU × 30s               | "Is the deploy alive?" — health probes + `/metrics` + featured + review summary all 200. |
| [`scripts/load.js`](./scripts/load.js)   | Nightly + before tagged releases. | 50→200→500 VUs over 6min | p95 < 300ms / p99 < 800ms on public reads (playbook §11 SLO).                            |

## Local run

```sh
# Boot the stack first.
docker compose -f infra/docker-compose.yml up -d

# Boot the API in another terminal (bind to :3000).
pnpm --filter=api dev

# Optional: seed demo data so review-summary endpoints return
# populated counts instead of zero-shape.
pnpm --filter=api db:seed:demo

# Smoke (fast).
k6 run infra/k6/scripts/smoke.js

# Load (slow, ~6 min).
k6 run infra/k6/scripts/load.js
```

## Staging / production-like run

Aim a real load test at staging — never at prod, never with `vus` >
the `RATE_LIMIT_PEPPER` budget.

```sh
k6 run \
  -e BASE_URL=https://api.staging.example.com \
  -e BEARER_TOKEN=<seeded-demo-user-jwt> \
  -e DEMO_TRIP_ID=<seeded-trip-id> \
  infra/k6/scripts/load.js
```

`BEARER_TOKEN` is optional but unlocks the `authed` group which
exercises the heaviest composite endpoint (`GET /trips/:id/overview`).
Mint a token from the demo seed: `db:seed:demo` registers `alice` /
`bob` users; grab the `accessToken` from the script output, OR call
`POST /auth/login` post-seed.

## CI integration

`smoke.js` is the gate; `load.js` is informational and shouldn't fail
a PR. Both wired into `ci.yml` only after a runner profile with k6
preinstalled lands — today they're manual / nightly invocations.

## Why thresholds at 300ms / 800ms?

Playbook §11: "p95 < 300ms for reads, < 800ms for AI endpoints".
Authed-group thresholds (500ms / 1500ms) are looser because the
trip-overview composite folds 7 sub-fetches; a 60s TTL cache from
`[IV.18.2.15]` brings the warm path well under, but cold-cache hits
still fan out.

## Future work

- Wire k6 cloud (or self-hosted Grafana k6) for trend graphs.
- Add a `chaos.js` script that injects 503 / latency via toxiproxy.
- Per-endpoint thresholds (today's are aggregate group-level).
