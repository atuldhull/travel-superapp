# Runbook — API availability SLO burn

**Pages on:** `ApiAvailabilityBurnFast` (page) · `ApiAvailabilityBurnMedium` (page) · `ApiAvailabilityBurnSlow` (ticket) · `ApiInstanceDown` (page).
**SLO:** 99.5 % over 28d, ~3h 21m budget (see [docs/slos.md](../slos.md)).
**Rule file:** [ops/prometheus/rules/api.rules.yml](../../ops/prometheus/rules/api.rules.yml) groups `api.alerts.availability` + `api.alerts.health`.

## Pager script (do this NOW, in order)

### 1. Confirm the alert is real (60 s)

```bash
# Fly: see if there are running machines + their statuses.
fly status --app travel-api
# Recent deploys (often the cause).
fly releases --app travel-api | head -10
# Live error rate over the last 5 minutes — Grafana panel
# "Error rate (5xx / total, 5m)" or, by hand:
curl -s 'http://prometheus/api/v1/query?query=api:error_ratio:5m' | jq '.data.result'
```

If `api:error_ratio:5m` is **0** and `up{job=travel-api}` is **1** for every
instance, the burn alert is stale → page silence + investigate.

### 2. Is it the most recent deploy? (90 s)

```bash
fly releases --app travel-api | head -5
# If the top release is < 30 minutes old AND the burn started after
# its time, ROLLBACK FIRST. Investigate after.
fly releases rollback <previous_release_id> --app travel-api
# OR: image-pin to last-known-good.
fly deploy --image registry.fly.io/travel-api:<sha-from-known-good>
```

A rolled-back deploy is reversible; a debugged-deploy that took
10 minutes longer is more user pain.

### 3. Is it Postgres or Redis? (90 s)

The api fails closed when its DB or Redis goes away. Check both:

```bash
# Postgres (Supabase): https://supabase.com/dashboard/project/<id>/health
# Redis (Upstash / managed): provider dashboard.

# Or from a working machine:
fly ssh console --app travel-api
psql "$DATABASE_URL" -c 'SELECT 1;'
redis-cli -u "$REDIS_URL" ping
```

If either is unreachable → ENTER THE BACKING-STORE INCIDENT path:

- Postgres down → [docs/runbooks/supabase-deploy.md](supabase-deploy.md) restore section, communicate ETA, status-page yellow.
- Redis down → degrade gracefully; cache misses log + the api recomputes. Set `CACHE_BYPASS=true` on the api if read paths are 5xx'ing because of Redis timeouts.

### 4. Is it a noisy hot path? (5 min)

Find the worst-offending route:

```promql
topk(5,
  sum(rate(http_request_duration_seconds_count{service="api",status=~"5.."}[5m])) by (route)
)
```

If one route dominates (e.g. `/api/v1/plan` because Anthropic is
melting), **disable** that route at the edge:

- Cloudflare WAF: block `/api/v1/<route>` (see `docs/runbooks/edge-rate-limiting.md`).
- Or set the feature flag for that subsystem off (e.g. `FEATURE_AGENT_ENABLED=false`).

### 5. Communicate

| Audience        | What                                                          |
| --------------- | ------------------------------------------------------------- |
| `#travel-pager` | `Investigating — <one-line>. ETA <N> min. Doc thread: <link>` |
| Status page     | "Some users may see errors on …" — yellow within 10 min       |
| `#travel-eng`   | `Rolling back <release-id> / Pinning <flag> off`              |

## Why this fires (root-cause patterns we've seen)

| Pattern                                         | Signal                                                 | Fix path                                                   |
| ----------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| Bad deploy → unhandled exception cascade        | Burn starts at release time; one stack trace dominates | Rollback (step 2)                                          |
| Postgres `max_connections` exhausted            | api logs `Connection is closed` + 500s spike           | Restart api (releases connections); investigate leak after |
| Redis outage during throttler eval              | 500s narrowly on rate-limited routes                   | `CACHE_BYPASS=true` + provider page                        |
| Anthropic / Gemini rate-limited or 5xx upstream | Burn ONLY on `/plan`, `/ai/*`, `/memory-book/*`        | Disable AI routes at edge, fall through to stub            |
| Memory leak → OOM kill → cold start             | RSS curve climbing, then drop; brief 5xx bursts        | Restart api hourly until root-cause; profile after         |

## After the bleeding stops

1. **Status page → green.**
2. **Page silence.**
3. **Post-mortem within 7 days** (template in `docs/runbooks/incident-response.md`).
4. **Update this runbook** with the new pattern if novel.

## Cross-refs

- [docs/slos.md](../slos.md) — the targets + budget policy
- [docs/runbooks/incident-response.md](incident-response.md) — IC + comms template
- [docs/runbooks/fly-deploy.md](fly-deploy.md) — deploy + rollback mechanics
- [docs/runbooks/supabase-deploy.md](supabase-deploy.md) — DB outage path
