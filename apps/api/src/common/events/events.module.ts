/**
 * Global EventBus module for apps/api.
 *
 * Provides the `EVENT_BUS` token (`@app/events`) backed by the
 * in-memory adapter today. The Redis Streams adapter (already in
 * `@app/events`) slots in behind a feature-flag swap when we want
 * cross-pod delivery + durable DLQ — not yet necessary for the
 * monolith's v1.
 *
 * Lifecycle: `close()` on shutdown drains in-flight handlers and
 * prevents further publishes (throws on new `publish()` after
 * close). Ordered via `onModuleDestroy` so NestJS calls it during
 * graceful shutdown.
 *
 * Installed by prompt [IV.18.2.7].
 */
import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { EVENT_BUS, InMemoryEventBus, type EventBus } from '@app/events';
import { createLogger } from '@app/logger';
import { MetricsService } from '../metrics/metrics.service';
import { MetricsRecordingEventBus } from './metrics-recording-event-bus';

const log = createLogger('events.module');

@Injectable()
class EventBusLifecycle implements OnModuleDestroy {
  constructor(private readonly bus: InMemoryEventBus) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.bus.close();
      log.info('event_bus_closed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({ err: message }, 'event_bus_close_failed');
    }
  }
}

@Global()
@Module({
  providers: [
    // Single shared InMemoryEventBus instance for the process. When
    // we promote to RedisStreamsEventBus, this factory is where the
    // env-gate lives (`if (env.EVENTS_BACKEND === 'redis') ...`).
    InMemoryEventBus,
    {
      // EVENT_BUS resolves to the metrics-decorated bus. Every
      // publish lands a `domain_events_total{event=<name>}` inc
      // before delegating to the underlying InMemoryEventBus.
      // Wiring lives here (not inside @app/events) so the events
      // package stays prom-client-free. Added by `[IV.18.10.7]`.
      provide: EVENT_BUS,
      useFactory: (bus: InMemoryEventBus, metrics: MetricsService) =>
        new MetricsRecordingEventBus(bus, metrics),
      inject: [InMemoryEventBus, MetricsService],
    },
    // Lifecycle holder so Nest calls `bus.close()` on shutdown.
    // Adding the provider chain ensures the `bus` argument is
    // resolved before close is invoked.
    EventBusLifecycle,
  ],
  exports: [EVENT_BUS, InMemoryEventBus],
})
export class EventsModule {}

export type { EventBus };
