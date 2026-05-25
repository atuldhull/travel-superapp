# Runbook — p95 read-latency SLO breach

**Fires:** `ApiP95ReadLatencyHigh` (ticket — not pager).
**Target:** p95 `GET/HEAD /api/v1/*` (non-AI) < 300 ms over 10 m.
**Source rule:** [ops/prometheus/rules/api.rules.yml](../../ops/prometheus/rules/api.rules.yml) group `api.alerts.latency`.

This is a ticket, not a page — read latency drifting high is a sign,
not an outage. Triage during business hours.

## Triage script

### 1. Which route is the offender?

```promql
topk(10,
  histogram_quantile(0.95,
    sum(rate(http_request_duration_seconds_bucket{service="api",method=~"GET|HEAD"}[10m])) by (le, route)
  )
)
```

If ONE route dominates the regression, go straight to its slice
owner. Two or more → likely shared infra (Postgres / Redis).

### 2. Is it Postgres slow queries?

```bash
# Supabase: dashboard → Database → Query Performance.
# Or against the running api:
fly ssh console --app travel-api
psql "$DATABASE_URL" -c '
  SELECT calls, mean_exec_time::int AS mean_ms, query
  FROM pg_stat_statements
  WHERE mean_exec_time > 50
  ORDER BY mean_exec_time DESC
  LIMIT 10;'
```

Look for: a recent query that's not hitting an index, a `SELECT t.*`
that's blown up since a new column landed (see
[feedback_pgvector_column_breaks_select_star](../../...) historical
note), or a missing PostGIS index.

### 3. Is it Redis miss-storm?

`Cache hit ratio` panel in `api-overview` dashboard < 20 % for the
incident window? Two patterns:

- A namespace bump (deploy that changed cache keys) — let TTLs warm
  back up, expect 5–15 min recovery.
- Redis OOM / eviction storm — provider dashboard.

### 4. Is it cold paths under load?

If hit ratio is healthy AND Postgres p95 is < 30 ms, the latency is
**in the api**. Check:

- Event-loop lag panel (Node `nodejs_eventloop_lag_seconds`). > 50 ms
  sustained = JS-side blocking; profile via `--inspect` against a
  prod-shaped corpus.
- A new heavy serialization step (Zod schema, JSON.stringify of a
  fat response).

## Fix patterns

| Pattern                                 | Fix                                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Missing index after migration           | Hand-curate migration to add the index (`migrate deploy` only) — see [feedback_prisma_migrate_drops_postgis_indexes](historical) |
| pgvector raw `SELECT *` on table        | Switch to explicit column projection                                                                                             |
| Hot endpoint has no cache layer         | Add `@app/cache` via the `TypedRedisCache` base                                                                                  |
| AI endpoint silently included in "read" | Tighten the regex in `ApiP95ReadLatencyHigh` rule to exclude it                                                                  |

## No-action thresholds

A single 10-minute > 300 ms blip during a deploy or schema migration
is acceptable — silence the ticket and add a note in the next
release notes. We only ESCALATE this alert when it fires for the
3rd time in 7 days on the same route.
