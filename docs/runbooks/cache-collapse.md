# Runbook — Cache hit ratio collapsed

**Fires:** `CacheHitRatioCollapsed` (ticket).
**Trigger:** aggregate cache hit ratio < 20 % for 30 m.
**Source rule:** [ops/prometheus/rules/api.rules.yml](../../ops/prometheus/rules/api.rules.yml) group `api.alerts.resilience`.

## What this actually means

The metric is `sum(cache_hit_total) / (sum(cache_hit_total) + sum(cache_miss_total))`
across every namespace from `TypedRedisCache` (trip-balances + 5
TTL-only providers today). A persistent < 20 % is one of four things:

1. **Redis is down** — cache misses fall through silently; counters
   only increment on the read path returning null. CHECK FIRST.
2. **Namespace bump** — a code change moved cache keys; old keys
   exist but are unreachable; new keys haven't warmed yet.
3. **Cold start after deploy / scale-down** — first 5–15 minutes of
   a fresh instance has no Redis warm-up. Expected; should self-heal.
4. **Adversarial traffic** — high-cardinality cache-busting on a
   public endpoint (e.g. `?ts=<random>` query strings missing the
   normalize layer).

## Triage script

### 1. Is Redis alive?

```bash
fly ssh console --app travel-api
redis-cli -u "$REDIS_URL" ping
redis-cli -u "$REDIS_URL" info stats | grep -E 'keyspace|expired|evicted'
```

`evicted_keys` growing fast → maxmemory hit. Bump the plan or
investigate which namespace is dominating memory.

### 2. Per-namespace breakdown

```promql
sum(cache_hit_total) by (cache) /
clamp_min(sum(cache_hit_total + cache_miss_total) by (cache), 1)
```

If ONE namespace is 0 % and the rest healthy, the regression is in
that slice. Most likely a key-format change.

### 3. Recent deploy?

```bash
fly releases --app travel-api | head -5
git log --oneline -20 -- 'apps/api/src/**/cache.ts' 'apps/api/src/**/*-cache.ts'
```

A commit that bumped `keyPrefix` or changed the cache-key recipe is
the usual suspect.

## Fix patterns

| Pattern                          | Fix                                                                    |
| -------------------------------- | ---------------------------------------------------------------------- |
| Redis outage                     | Page the provider. `CACHE_BYPASS=true` if the api 5xx's on cache calls |
| Namespace bump (just deployed)   | Let it warm for 15 m; if SLO is at risk, revert + redeploy             |
| `maxmemory` hit (eviction storm) | Bump Redis plan; in the meantime, lower TTLs on the noisiest namespace |
| Adversarial cache-buster         | Edge WAF rule to strip / normalize the offending query param           |

## No-action thresholds

- < 30 min after a deploy with cache-key changes — silence + recheck.
- A weekend / holiday traffic-dip naturally inflates the miss ratio because
  the surface has fewer warm keys. Compare against the same weekday a
  week ago before escalating.

## See also

- [`docs/runbooks/redis-cluster-posture.md`](redis-cluster-posture.md) — single-node vs. cluster posture; what stays cluster-safe and how to migrate ([Q2]).
- [`docs/runbooks/database-pooling.md`](database-pooling.md) — Postgres is the cache's source of truth; cache collapse cascades onto Postgres CPU + connection pool ([Q1]).
