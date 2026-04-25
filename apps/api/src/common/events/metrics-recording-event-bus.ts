/**
 * EventBus decorator that records `domain_events_total{event=<name>}`
 * on every publish, then delegates to the inner bus. Subscribe and
 * close pass through unchanged.
 *
 * Why a decorator vs. instrumenting `InMemoryEventBus` directly:
 * the bus implementation lives in the `@app/events` workspace
 * package, which is intentionally decoupled from app-specific
 * concerns like prom-client. The decorator pattern lets the
 * monolith hook metrics in at the wiring layer without coupling
 * the package, and keeps the `RedisStreamsEventBus` swap from
 * `[IV.18.1.9]` symmetric (the same decorator wraps either).
 *
 * Failures in `metrics.recordEvent` are swallowed at the
 * MetricsService layer (no-op before init); we still publish to
 * the inner bus regardless. Metric drops shouldn't break the
 * primary write path.
 *
 * Installed by prompt [IV.18.10.7].
 */
import type {
  DomainEvent,
  EventBus,
  EventHandler,
  SubscribeOptions,
  Subscription,
} from '@app/events';
import type { MetricsService } from '../metrics/metrics.service';

export class MetricsRecordingEventBus implements EventBus {
  constructor(
    private readonly inner: EventBus,
    private readonly metrics: MetricsService,
  ) {}

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    this.metrics.recordEvent(event.name);
    return this.inner.publish(event);
  }

  subscribe<TPayload>(
    eventName: string,
    handler: EventHandler<TPayload>,
    options?: SubscribeOptions,
  ): Subscription {
    return this.inner.subscribe(eventName, handler, options);
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}
