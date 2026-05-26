# Runbook — Redis cluster posture

> **Installed by [Q2]** of the Scale-readiness 3→10 series. Companion to [database-pooling.md](database-pooling.md) + [cache-collapse.md](cache-collapse.md).
>
> Redis is the bus for **everything that has to be fast**: rate-limit counters, JWT-blacklist, session refresh tokens, cache layers (`@app/cache`), BullMQ queues, Redis Streams event bus. A single-instance failure today is an availability incident; a slot-routing miscalculation in cluster mode is silent data loss. This runbook documents the **single source of truth on what works in each posture and how to migrate between them**.

## Postures at a glance

| Posture                           | Where                       | Failover  | Throughput ceiling      | Notes                                                                                    |
| --------------------------------- | --------------------------- | --------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| **Single-node (dev)**             | `infra/docker-compose.yml`  | none      | ~80k ops/s on dev box   | Default. Day-1 onboarding. No special code path.                                         |
| **Managed primary + replica**     | Upstash standard tier       | yes (~3s) | ~100k ops/s             | What production uses today. AOF + nightly snapshot — see [backups-dr.md](backups-dr.md). |
| **Upstash Global (multi-region)** | Upstash Global plan         | yes (~1s) | ~250k ops/s + read-near | Operator-owed upgrade for the [Q9] multi-region story.                                   |
| **Cluster mode (sharded)**        | Upstash Cluster / self-host | yes       | unbounded               | Required only past ~500k ops/s. Requires every multi-key op to share a slot.             |

We are at **Managed primary + replica today** for production (Upstash standard) and **single-node** in dev. Cluster mode is the long-tail option — `[Q2]` ships the code patterns now so the migration is a config flip when we need it.

## Why this matters

Redis cluster shards by **slot**: `CRC16(key) mod 16384`. A single command always targets one slot, so it's safe. A **multi-key** command (`MULTI/EXEC`, `MGET`, `EVAL`, `SUNIONSTORE`, etc.) is only safe if every key hashes to the **same slot**. Two unrelated keys on the same multi-key op = `CROSSSLOT Keys in request don't hash to the same slot`. Cluster mode rejects it at runtime; non-cluster modes accept it silently and create a footgun the day you upgrade.

The fix: **hash tags**. Anything between `{...}` in a key participates in the slot hash; the rest is ignored:

```text
travel-prod:trip:abc:status         → CRC16("travel-prod:trip:abc:status") mod 16384
travel-prod:trip:{abc}:status       → CRC16("abc") mod 16384
travel-prod:trip:{abc}:items        → CRC16("abc") mod 16384   ← same slot as :status
```

If two keys must be touched together, put the shared identifier in `{...}`. If a key is touched alone, the tag is optional but recommended for readability.

## Rules enforced today

The [`architecture.fitness.spec.ts`](../../apps/api/test/architecture.fitness.spec.ts) suite blocks the worst offenders. Lock these in your head before adding new Redis code:

1. **No `redis.keys(...)`**. `KEYS *` is `O(n)` over the whole keyspace and blocks the single-threaded server. Use `SCAN` with cursors (`redis.scanStream(...)` from ioredis). Cluster mode refuses `KEYS` outright on a multi-slot keyspace anyway.
2. **No `MULTI/EXEC` across unrelated keys**. If you pipeline two keys, they must share a hash tag.
3. **No `EVAL` / Lua over multiple keys** unless the keys are passed in `KEYS[1..n]` (not hardcoded inside the script) AND share a hash tag.
4. **Every Redis-owning class has `OnModuleDestroy` + `.quit()`**. Already a fitness invariant from [M1]; cluster failover relies on the client being able to close cleanly to reconnect.
5. **`scanStream` over `scan` in code** — the stream form returns batches; a hand-coded loop over `scan` rarely terminates correctly under high write throughput.

## Patterns by use case

### Rate-limit counter (per-user, per-window)

Single key — slot-safe by default. Tag for readability:

```ts
const key = `travel-${env}:rate:{user:${userId}}:${routeBucket}`;
await redis.incr(key);
await redis.pexpire(key, windowMs, 'NX');
```

### Failed-login counter (per-email-hash, multi-step)

Already in the repo at [`redis-failed-login-counter.ts`](../../apps/api/src/modules/identity/infrastructure/redis-failed-login-counter.ts). Uses `.multi()` over a single key — cluster-safe.

### Cache invalidation by tag

The naive form (`KEYS travel-prod:cache:trip:*`) is forbidden. Use a Redis Set as a reverse-index:

```ts
// On write: maintain the index alongside the value.
const tag = `travel-${env}:cache:tag:{trip:${tripId}}`;
await redis.multi().set(valueKey, value, 'EX', ttl).sadd(tag, valueKey).exec();
// On invalidation: read the set, delete its members in batched UNLINK.
const members = await redis.smembers(tag);
if (members.length) await redis.unlink(...members);
await redis.unlink(tag);
```

The tag key and the value keys share `{trip:${tripId}}`, so the `MULTI`+`SMEMBERS`+`UNLINK` is slot-safe.

### BullMQ queues (Q3 lands real queues)

BullMQ is cluster-aware: it auto-prefixes queue keys with `{<queue>}` so all the keys for one queue land on one slot. No manual tagging needed when you use the `Queue` / `Worker` factories — see [Q3 runbook (forthcoming)].

### Redis Streams event bus

Each stream's keys are on one slot automatically (`XADD` / `XREAD` / consumer-group state share the stream name). The fan-in pattern (Notifications listens to every stream) means a multi-stream `XREADGROUP` MUST hit the same slot — wrap each stream in its own `{stream}` tag.

## Migration path to cluster

When ops/cost-monitoring shows you sustained > 250k ops/s on the primary, or when [Q9] flips on multi-region:

1. **Provision** a cluster-mode Upstash database (or `redis-cli --cluster create` for self-host).
2. **Switch the client constructor** from `new Redis(url)` to `new Redis.Cluster([{host, port}, ...])`. Already abstracted behind a factory in `apps/api/src/common/redis/redis.factory.ts` (audit it before flipping).
3. **Run the cluster-safety preflight**: `pnpm --filter=api test -- --testPathPattern=redis-cluster-safety` (a forthcoming integration spec; today the fitness gate is the static check).
4. **Drain workers** before cutover — BullMQ rejects new jobs cleanly; in-flight jobs complete on the old instance; new jobs land on the cluster.
5. **Cutover** via env-var swap. Watch the cache-hit-ratio dashboard ([`external-resilience.json`](../../ops/observability/grafana/dashboards/external-resilience.json)) for cold-cache collapse — should recover in < 5 min.
6. **Rollback** is a second env-var swap (cluster URL → primary URL). The old instance keeps state during the cutover window (set TTL `>` 1h on the cutover day).

## Common failure modes

### `CROSSSLOT Keys in request don't hash to the same slot`

You wrote a `MULTI/EXEC` / `MGET` / `EVAL` across slots. Find the call site, add a shared hash tag.

### `MOVED <slot> <ip>:<port>`

The cluster client is mis-routing because slots are being resharded. ioredis-cluster handles this transparently — if you see it bubbling up, your client version is < 5.4. Upgrade.

### Cache stampede after failover

The replica promotes, but the new primary has stale data. The cache hit ratio collapses; the api falls back to source-of-truth Postgres; Postgres CPU spikes. See [cache-collapse.md](cache-collapse.md) for the response playbook.

### Sentinel timeout under failover

Upstash handles sentinel internally; you should never see it. If you self-host with Redis Sentinel, set `sentinelRetryStrategy` on the ioredis options — default is too aggressive for transient leader elections.

## Operator-owed

1. **Confirm Upstash plan** — standard tier (primary + replica) is what prod needs today; verify in Upstash console.
2. **For [Q9] multi-region**: upgrade to Upstash Global. ~$0.30/100k commands, but read-near-region cuts p95 by ~80 ms.
3. **For > 250k ops/s sustained**: upgrade to Upstash Cluster. Operator-owed; engineering-owed is "every multi-key op already uses hash tags" — gated below.

## See also

- [`apps/api/test/architecture.fitness.spec.ts`](../../apps/api/test/architecture.fitness.spec.ts) — fitness invariants enforcing the rules above
- [`docs/runbooks/cache-collapse.md`](cache-collapse.md) — what to do when the cache hit ratio falls off a cliff
- [`docs/runbooks/backups-dr.md`](backups-dr.md) — Redis backup posture (AOF + snapshot)
- [Upstash — cluster mode](https://upstash.com/docs/redis/howto/connectwithupstashredis)
- [ioredis — cluster client](https://github.com/redis/ioredis#cluster)
