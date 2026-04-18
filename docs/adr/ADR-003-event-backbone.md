# ADR-003 — Event backbone: Redis Streams first, Kafka/Redpanda later

- **Status:** Accepted
- **Date:** 2026-04-18
- **Prompt:** `[II.6.4]`
- **Playbook reference:** §6.4

## Context

Cross-context communication inside the monolith ([ADR-001](./ADR-001-modular-monolith.md)) and between the extracted services ([ADR-002](./ADR-002-service-extraction-triggers.md)) is event-driven. We need a concrete transport.

The candidates in a Node-first, small-team shop are:

- **Redis Streams** — already in the stack (`infra/docker-compose.yml` runs Redis 7 for cache + sessions + queues). Consumer groups, XADD/XREAD, adequate durability.
- **Kafka / Redpanda** — battle-tested at scale, higher ops burden, separate cluster.
- **NATS JetStream** — small, fast, fewer features than Kafka.
- **Postgres LISTEN/NOTIFY + outbox** — uses the DB we already have, but scaling ceiling is low.

## Decision drivers

- **Zero new infrastructure at MVP.** We already run Redis; adding Kafka means a three-node cluster and ZooKeeper/KRaft to babysit.
- **Operational familiarity.** Our team knows Redis; no one here runs Kafka in prod.
- **Throughput ceiling.** Redis Streams handles ~50k events/s per instance comfortably — orders of magnitude above MVP traffic.
- **Adapter pattern.** The transport MUST be swappable without touching domain code.

## Considered options

1. **Redis Streams for v1.**
2. **Kafka / Redpanda from day one.**
3. **Postgres LISTEN/NOTIFY + transactional outbox.**
4. **In-memory only (EventEmitter).**

## Decision outcome

**Chose option 1 — Redis Streams, with a migration path to Kafka/Redpanda.**

The event bus lives in `@app/events` (to be built in prompt `[IV.18.1.9]`). It exposes:

```ts
interface EventBus {
  publish<E extends DomainEvent>(event: E): Promise<void>;
  subscribe<E extends DomainEvent>(name: E['name'], handler: (e: E) => Promise<void>): void;
}
```

…backed by a `RedisStreamsEventBus` adapter. The interface is what every consumer uses; the Redis implementation is a replaceable detail.

### Migration trigger → Kafka / Redpanda

We move off Redis Streams when **any** of these becomes true:

1. **Throughput** — sustained > 30k events/s across the bus (60% of the soft ceiling), measured over a rolling 7d window.
2. **Cross-region fan-out** — we're running in > 1 region and need partitioned, geo-aware consumption.
3. **Long retention** — a consumer needs to replay > 7 days of history routinely. Redis Streams retention is possible but expensive vs. Kafka's log-structured storage.
4. **Schema governance at scale** — we need a Schema Registry and broker-side schema enforcement (Confluent-style).

If any of those hits, the migration is:

- Keep the `EventBus` interface unchanged.
- Implement `KafkaEventBus` or `RedpandaEventBus` behind the same interface.
- Swap adapters via module config. No domain code changes.

Until that trigger fires, **Redis Streams is the answer**.

### Positive consequences

- Zero new infra. Redis is already running.
- The `@app/events` package ships a port-first API; the production code never sees Redis types.
- Consumer groups give us per-module back-pressure and at-least-once delivery with DLQ via stream claim.
- Migration is a code change, not a re-architecture.

### Negative consequences

- Redis is an in-memory store first; a crash within the fsync window loses a small tail of events. Acceptable for our current event classes (analytics, cross-context notifications); unacceptable for anything where "event lost" means "customer doesn't get charged" — those paths must use the transactional outbox on Postgres, not the event bus.
- Redis Streams tooling (observability, replay, schema validation) is less mature than Kafka's. We accept this; the alternative is running Kafka now.

## Consequences (binding)

- Every cross-context message in `apps/api` goes through `@app/events`. Direct calls to `ioredis.xadd` from domain / application code fail code review.
- Payment / billing events that require durable commit-and-fire semantics use a transactional outbox pattern (write event row in the same Postgres transaction as the business row; worker tails the outbox). They do NOT go directly onto Redis Streams.
- Adding a new event type requires: (a) a Zod schema in `@app/shared-types`, (b) a DLQ retention decision (default 7 days), (c) a producer and at least one consumer.

## Links

- Playbook §6.4.
- Sibling: [ADR-001](./ADR-001-modular-monolith.md), [ADR-002](./ADR-002-service-extraction-triggers.md).
- Prompt `[IV.18.1.9]` — implementation.
- [Redis Streams intro](https://redis.io/docs/latest/develop/data-types/streams/).
- [Confluent, "Streaming ledger"](https://www.confluent.io/blog/event-driven-architecture/) — for when the trigger fires.
