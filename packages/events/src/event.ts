/**
 * Canonical shape for every cross-context domain event.
 *
 * Event names follow the convention from
 * `docs/architecture/context-map.md`: `<Publisher>.<Aggregate><Verb>`
 * in PascalCase past-tense — e.g. `Trip.TripDrafted`,
 * `Identity.UserRegistered`, `Safety.SosTriggered`. The first segment
 * (publisher) is the only thing that identifies the owning context;
 * every other context can subscribe by name alone.
 *
 * `occurredAt` is the event's original timestamp (producer's clock).
 * `receivedAt` — if set by the transport on delivery — is the consumer
 * side stamp; useful for end-to-end latency metrics.
 *
 * `version` is an integer. Bump when the payload shape breaks
 * backward-compatibility. Consumers MUST skip events with a higher
 * version than they understand (forward-compat) or fall back to a
 * vetted translation (backward-compat).
 *
 * Installed by prompt [IV.18.1.9].
 */
export interface DomainEvent<TPayload = unknown> {
  /** `<Publisher>.<AggregateVerb>` e.g. `Trip.TripDrafted`. */
  readonly name: string;
  /** Server-generated unique id — used for at-most-once semantics by consumers that choose to dedupe. */
  readonly id: string;
  /** Integer version. Bump on breaking payload change. */
  readonly version: number;
  /** Producer's wall-clock stamp. ISO-8601 on the wire; `Date` in-process. */
  readonly occurredAt: Date;
  /** Optional trace propagation — populated when the producer runs inside `runWithTraceContext`. */
  readonly traceId?: string;
  /** Freeform structured payload. Narrow with a Zod schema per event. */
  readonly payload: TPayload;
}

/**
 * Narrower event-name type for typed subscriptions. Consumers can
 * pin to `DomainEventOfName<'Trip.TripDrafted', TripDraftedPayload>`.
 */
export interface DomainEventOfName<TName extends string, TPayload> extends DomainEvent<TPayload> {
  readonly name: TName;
}

/** Serialisable wire shape — same as `DomainEvent` but `occurredAt` is an ISO string. */
export interface DomainEventWire<TPayload = unknown> {
  readonly name: string;
  readonly id: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly traceId?: string;
  readonly payload: TPayload;
}
