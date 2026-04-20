/**
 * @app/events — domain-event bus for TravelSuperApp.
 *
 * Entry points:
 *   • `EventBus` — the port. Every consumer depends on this, never
 *     on a specific adapter (CLAUDE.md rule 10 → swap-adapter,
 *     no-code-change migration path to Kafka/Redpanda, [ADR-003]).
 *   • `InMemoryEventBus` — in-process adapter. Fast + deterministic.
 *     Use in unit tests + single-process dev tooling.
 *   • `RedisStreamsEventBus` — production adapter. Streams + consumer
 *     groups + at-least-once + DLQ.
 *   • `DomainEvent` — canonical shape. See `event.ts` header for
 *     naming convention (`<Publisher>.<AggregateVerb>`).
 *   • `EVENT_BUS` — Nest DI token.
 *
 * Swap-to-Kafka path: implement a `KafkaEventBus: EventBus`; bind it
 * to `EVENT_BUS` in the module factory. Zero domain-code changes.
 * ADR-003's migration triggers spell out when this becomes the right
 * move (throughput > 30k ev/s for 7d, cross-region fan-out, etc.).
 *
 * Installed by prompt [IV.18.1.9]. See Playbook §6.4 + [ADR-003].
 */
export type { DomainEvent, DomainEventOfName, DomainEventWire } from './event';
export {
  EVENT_BUS,
  type EventBus,
  type EventHandler,
  type SubscribeOptions,
  type Subscription,
} from './event-bus';
export { InMemoryEventBus, type DeadLetterRecord } from './in-memory-event-bus';
export { RedisStreamsEventBus, type RedisStreamsEventBusOptions } from './redis-streams-event-bus';
