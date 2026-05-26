# ADR-011 — TypedRedisCache shared base + write-invalidated subset

- **Status:** Accepted
- **Date:** 2026-04-26
- **Prompt:** `[IV.18.19.7]` (codifies the pattern shipped in `[IV.18.8.1]`, extended by `[IV.18.10.4]`, `[IV.18.10.5]`, `[IV.18.10.6]`, `[IV.18.2.15]`)
- **Playbook reference:** §11 (Caching) + §32 (Local stack — Redis dev)

## Context

By the time five caches existed (weather, stays, food, places, events), each module had pasted ~70 lines of identical Redis-client wiring: `lazyConnect`, `enableOfflineQueue: false`, `ensureConnected` guard, get/set with try/catch swallow-and-log, key prefix `travel-<env>:<namespace>:`, JSON serialization. A sixth cache (transport) was about to land with the same paste. A seventh (trip-balances) needed the same machinery PLUS a `del()` method for write-invalidation. An eighth (trip-overview) needed the same machinery PLUS observability.

We needed one decision: **collapse to a shared base class? Or stay with copy-paste?**

The answer drove how every future cache lands and how observability cross-cuts them.

## Decision drivers

- **DRY for shared infra is mandatory; DRY for domain logic is optional.** Cache wiring is pure infrastructure — every consumer uses the exact same Redis idioms. Diverging by accident (e.g. one cache forgetting `enableOfflineQueue: false`) creates production surprises.
- **Subclasses, not factories.** NestJS DI resolves by class token + constructor injection. A factory would force every consumer to use `{ provide: X, useFactory: ... }` — more ceremony for the same outcome.
- **Per-instance Redis client is the right unit of failure.** A shared client across namespaces couples invalidation domains; one cache's outage shouldn't ripple. Mirrors the pattern `RedisThrottlerStorage` already uses.
- **Swallow-and-log on Redis failure.** A dead cache must degrade to "no cache" — the caller returns the fresh value. Propagating the error would make a Redis outage take down the consumer endpoint, defeating the resilience purpose of cache.
- **Two cache flavours, not one.** Most caches are TTL-only (weather, places, etc.) — cheap to be slightly stale. Some need write-invalidation: trip-balances changes when an expense is added/deleted, and a 60s stale window on "do I owe Alice $20?" is wrong. The base needs `del(key)`.
- **Observability must cross-cut without subclass churn.** When the time came to add `cache_hit_total` / `cache_miss_total` Prometheus counters, we couldn't ask seven subclasses to forward a metrics service through their constructors. The base needed a static-instance registry that the metrics layer walks at scrape time.

## Considered options

### A. One Redis client + namespace-prefixed keys, shared across modules

- **Shape:** module-level `Redis` instance shared via DI; each cache prefixes its own namespace.
- **Pros:** one connection.
- **Cons:** coupled failure domain; namespace bugs across modules read each other's data; harder to wire per-cache observability (which cache emitted the hit?).

### B. Copy-paste per cache (status quo before [IV.18.8.1])

- **Shape:** each cache module owns its own ~70-line `RedisXxxCache`.
- **Pros:** zero abstraction; one cache's behaviour can drift without touching others.
- **Cons:** drift IS a bug, not a feature. Five copies of "remember `enableOfflineQueue: false`" is five chances to forget. Adding observability later means seven separate edits.

### C. Shared `TypedRedisCache<T>` abstract base · **CHOSEN**

- **Shape:** `apps/api/src/common/cache/typed-redis-cache.ts` is a generic abstract class. Subclasses are ~10 lines:

  ```ts
  @Injectable()
  export class RedisWeatherCache extends TypedRedisCache<WeatherForecast> implements WeatherCache {
    constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
      super(config, 'weather', 'weather.cache');
    }
  }
  ```

- The base owns: ioredis client (with `lazyConnect` + `enableOfflineQueue: false`), `keyPrefix = 'travel-<env>:<namespace>:'`, `get/set/del`, error-swallow + log, `OnModuleDestroy.quit()`, hit/miss counters + structured `cache_hit` / `cache_miss` log events ([IV.18.10.5]), static instance registry for the prom-client metrics walker ([IV.18.10.6]).
- TTL-only caches are subclasses that use `get/set` only; write-invalidated caches additionally call `del(key)` from their write paths.
- **Pros:**
  - Adding a new cache is ~10 lines.
  - All seven caches share the same connection idioms — no drift.
  - Per-instance metrics counters surface every cache on `/metrics{cache=<namespace>}` automatically; new subclasses join the registry on construction with zero wiring.
  - Write-invalidation pattern is opt-in (`del(key)`) — TTL-only callers ignore it.
- **Cons:**
  - Generic class with `<T>` adds a small typing overhead for the trip-overview cache, which stores DTO unions; we cast `unknown` on read in the controller (documented in [IV.18.2.15]).
  - Static registry is process-global; in test mode we explicitly clean up via `onModuleDestroy` to keep Jest from leaking handles.

## Decision

Adopt **option C**: a single `TypedRedisCache<T>` abstract base in `apps/api/src/common/cache/`. Every cache subclass extends it with a namespace + logger name. TTL-only caches use `get/set`; write-invalidated caches additionally call `del()` from their write paths (auth-gate runs BEFORE the cache read — see [IV.18.10.4]).

Cardinality of the metrics labels stays bounded by cache count (currently 7), no user-derived labels.

## Consequences

**Positive:**

- Six subclasses landed at ~10 lines each.
- Observability (`/metrics`) auto-discovered every cache when `[IV.18.10.6]` shipped — zero subclass touch.
- Write-invalidation pattern proven on `TripBalancesCache`; the contract is reusable for any future cache that needs sub-TTL freshness.
- A future swap (Redis Cluster, in-memory LRU) is one base-class change, not seven.

**Negative / open:**

- The static-instance registry pattern is unconventional — relies on every subclass being constructed via DI as a singleton. A consumer that constructs a cache outside the DI graph (e.g. inside a test that doesn't import `AppModule`) has to either join the registry manually or accept the metric won't surface.
- `<T>` generics don't carry through to the metrics counters (which only see the namespace string). Per-cache type-erasure is fine for ops dashboards.
- TypedRedisCache is in `apps/api/src/common/cache/`, not `@app/cache`. Promote to a workspace package when `notification-worker` or `crawler-worker` grow a cache — until then it would be cross-app overhead with one consumer.

## Cross-references

- [ADR-003 — Event backbone](./ADR-003-event-backbone.md) for the same port/adapter pattern at the event-bus layer
- `[IV.18.8.1]` — original collapse to shared base
- `[IV.18.10.4]` — `del()` method + write-invalidated `TripBalancesCache`
- `[IV.18.10.5]` — hit/miss counters + `getStats()` accessor
- `[IV.18.10.6]` — prom-client `/metrics` endpoint walks the static registry
- `[IV.18.2.15]` — `TripOverviewCache` ships at ~25 lines on top of the base
