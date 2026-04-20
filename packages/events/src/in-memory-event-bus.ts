import type { DomainEvent } from './event';
import type { EventBus, EventHandler, SubscribeOptions, Subscription } from './event-bus';

/**
 * In-process EventBus implementation for tests. NOT suitable for
 * production — consumers don't survive a process restart, no DLQ
 * persistence, no cross-pod delivery.
 *
 * Semantics (matches the `EventBus` contract):
 *   • `publish(event)` dispatches synchronously to each consumer
 *     group's handler, awaiting the handler's promise sequentially
 *     within a group. Different groups dispatch in parallel via
 *     `Promise.all`.
 *   • Each consumer group sees each event once.
 *   • Handler failures retry up to `deadLetterAfterAttempts`, then
 *     land in a DLQ that callers can inspect via `drainDlq()`.
 *
 * Installed by prompt [IV.18.1.9].
 */
interface InternalSub {
  readonly consumerGroup: string;
  readonly handler: EventHandler;
  readonly deadLetterAfterAttempts: number;
}

export interface DeadLetterRecord {
  readonly event: DomainEvent;
  readonly consumerGroup: string;
  readonly attempts: number;
  readonly lastError: string;
}

const DEFAULT_DEAD_LETTER_ATTEMPTS = 3;

export class InMemoryEventBus implements EventBus {
  /** eventName → list of subscriptions (one per consumer group). */
  private readonly subs = new Map<string, InternalSub[]>();
  /** Accumulating DLQ. Inspected via `drainDlq()`. */
  private readonly dlq: DeadLetterRecord[] = [];
  private closed = false;
  /** Monotonic counter for default consumer-group naming. */
  private groupCounter = 0;

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    if (this.closed) throw new Error('InMemoryEventBus: already closed');
    const subs = this.subs.get(event.name);
    if (!subs || subs.length === 0) return;
    await Promise.all(subs.map((s) => this.dispatch(event, s)));
  }

  subscribe<TPayload>(
    eventName: string,
    handler: EventHandler<TPayload>,
    options: SubscribeOptions = {},
  ): Subscription {
    if (this.closed) throw new Error('InMemoryEventBus: already closed');
    const consumerGroup = options.consumerGroup ?? `anon-${++this.groupCounter}`;
    const sub: InternalSub = {
      consumerGroup,
      handler: handler as EventHandler,
      deadLetterAfterAttempts: options.deadLetterAfterAttempts ?? DEFAULT_DEAD_LETTER_ATTEMPTS,
    };
    const existing = this.subs.get(eventName) ?? [];
    existing.push(sub);
    this.subs.set(eventName, existing);

    return {
      eventName,
      consumerGroup,
      unsubscribe: async () => {
        const current = this.subs.get(eventName);
        if (!current) return;
        const filtered = current.filter((s) => s !== sub);
        if (filtered.length === 0) this.subs.delete(eventName);
        else this.subs.set(eventName, filtered);
      },
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    this.subs.clear();
  }

  /** Read + clear the accumulated DLQ entries. Test-only affordance. */
  drainDlq(): DeadLetterRecord[] {
    const items = [...this.dlq];
    this.dlq.length = 0;
    return items;
  }

  private async dispatch(event: DomainEvent, sub: InternalSub): Promise<void> {
    let lastError = '';
    for (let attempt = 1; attempt <= sub.deadLetterAfterAttempts; attempt++) {
      try {
        await sub.handler(event);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    this.dlq.push({
      event,
      consumerGroup: sub.consumerGroup,
      attempts: sub.deadLetterAfterAttempts,
      lastError,
    });
  }
}
