import type { DomainEvent } from './event';

/**
 * Port. The one interface every adapter must implement.
 *
 * `publish` is fire-and-forget at the port level: the returned promise
 * resolves once the event is accepted by the transport. Delivery to
 * consumers is the adapter's responsibility + at-least-once guarantee.
 *
 * `subscribe` returns an unsubscribe handle. Implementations SHOULD
 * ack-on-handler-resolve and retry-on-handler-reject; see
 * `SubscribeOptions.deadLetterAfterAttempts`.
 *
 * `subscribe` semantics:
 *  • Each `consumerGroup` receives the event exactly once across
 *    members of that group (competing consumers). Different groups
 *    each receive the event independently — this is how Notifications
 *    and Analytics can both subscribe to the same `Trip.TripPublished`
 *    without one starving the other.
 *  • Handler failures (rejected promise / thrown error) trigger retry
 *    up to `deadLetterAfterAttempts`, then the event is moved to the
 *    dead-letter stream `<origin>:dlq`.
 *
 * Installed by prompt [IV.18.1.9]. See [ADR-003](../../../docs/adr/ADR-003-event-backbone.md).
 */
export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;

  subscribe<TPayload>(
    eventName: string,
    handler: EventHandler<TPayload>,
    options?: SubscribeOptions,
  ): Subscription;

  /** Flush in-flight handlers + close the transport. Idempotent. */
  close(): Promise<void>;
}

export type EventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>,
) => void | Promise<void>;

export interface SubscribeOptions {
  /**
   * Name of the consumer group. Every module has its own group: passing
   * `'notifications'` from the notifications module means a different
   * consumer group than `'analytics'` even if both subscribe to the
   * same event name.
   *
   * Defaults to a group derived from the process PID — fine for tests
   * and single-process dev, NOT what you want in production. Set it
   * explicitly to the module name in real code.
   */
  readonly consumerGroup?: string;

  /**
   * Retry the handler this many times on failure before routing the
   * event to the dead-letter stream. Default: 3.
   */
  readonly deadLetterAfterAttempts?: number;
}

export interface Subscription {
  readonly eventName: string;
  readonly consumerGroup: string;
  /** Stop consuming. Safe to call more than once. */
  unsubscribe(): Promise<void>;
}

/** DI token (NestJS `@Inject(EVENT_BUS)`). */
export const EVENT_BUS = Symbol.for('travel:event-bus');
