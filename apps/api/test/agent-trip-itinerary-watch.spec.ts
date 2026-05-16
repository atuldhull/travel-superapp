/**
 * Agent↔trip real triggers — TripItineraryWatchHandler (pure/fake,
 * no bus, no DB, ZERO keys → LAW 1).
 *
 * Proves the watch-START trigger:
 *   - flag ON + Trip.ItineraryGenerated → opens a weather watch
 *     (subscribedSignals ['weather'], threshold 0.7)
 *   - idempotent: TRIP_WATCH_ALREADY_ACTIVE is swallowed (itinerary
 *     regenerates) — the handler never throws back into the bus
 *   - any other failure is swallowed too (best-effort)
 *   - flag OFF → complete NO-OP (the feature ships dark)
 *   - onModuleDestroy unsubscribes (idempotent)
 *
 * Installed by the agent↔trip real-triggers slice.
 */
import { ConflictError } from '@app/errors';
import type { EventBus, EventHandler, Subscription } from '@app/events';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TripItineraryWatchHandler } from '../src/modules/agent/application/handlers/trip-itinerary-watch.handler';
import type { StartTripWatchUseCase } from '../src/modules/agent/application/start-trip-watch.use-case';

function makeBus(): {
  bus: EventBus;
  fire: (payload: unknown) => Promise<void>;
  unsubscribed: () => number;
} {
  let handler: EventHandler<unknown> | null = null;
  let unsubs = 0;
  const sub: Subscription = {
    eventName: 'Trip.ItineraryGenerated',
    consumerGroup: 'agent.trip-itinerary-watch',
    unsubscribe: async () => {
      unsubs += 1;
    },
  };
  const bus = {
    subscribe: (_name: string, h: EventHandler<unknown>) => {
      handler = h;
      return sub;
    },
    publish: async () => {},
    close: async () => {},
  } as unknown as EventBus;
  return {
    bus,
    fire: async (payload: unknown) => {
      if (!handler) throw new Error('not subscribed');
      await handler({
        name: 'Trip.ItineraryGenerated',
        id: 'evt1',
        version: 1,
        occurredAt: new Date(),
        payload,
      } as never);
    },
    unsubscribed: () => unsubs,
  };
}

function cfg(enabled: boolean): ConfigService<Env, true> {
  return { get: () => enabled } as unknown as ConfigService<Env, true>;
}

const PAYLOAD = { tripId: 't1', userId: 'owner1', dayCount: 3 };

describe('TripItineraryWatchHandler (watch-start trigger)', () => {
  it('flag ON + itinerary event → starts a weather watch (0.7)', async () => {
    const { bus, fire } = makeBus();
    const calls: unknown[] = [];
    const startWatch = {
      execute: async (cmd: unknown) => {
        calls.push(cmd);
        return { agentRunId: 'run1', tripWatchId: 'w1' };
      },
    } as unknown as StartTripWatchUseCase;
    const h = new TripItineraryWatchHandler(bus, cfg(true), startWatch);
    h.onApplicationBootstrap();
    await fire(PAYLOAD);
    expect(calls).toEqual([
      { tripId: 't1', subscribedSignals: ['weather'], thresholds: { weather: 0.7 } },
    ]);
  });

  it('idempotent: TRIP_WATCH_ALREADY_ACTIVE is swallowed (no throw)', async () => {
    const { bus, fire } = makeBus();
    const startWatch = {
      execute: async () => {
        throw new ConflictError('dup', { tripId: 't1' }, 'TRIP_WATCH_ALREADY_ACTIVE');
      },
    } as unknown as StartTripWatchUseCase;
    const h = new TripItineraryWatchHandler(bus, cfg(true), startWatch);
    h.onApplicationBootstrap();
    await expect(fire(PAYLOAD)).resolves.toBeUndefined();
  });

  it('any other failure is swallowed too (never throws into the bus)', async () => {
    const { bus, fire } = makeBus();
    const startWatch = {
      execute: async () => {
        throw new Error('db down');
      },
    } as unknown as StartTripWatchUseCase;
    const h = new TripItineraryWatchHandler(bus, cfg(true), startWatch);
    h.onApplicationBootstrap();
    await expect(fire(PAYLOAD)).resolves.toBeUndefined();
  });

  it('flag OFF → complete NO-OP (StartTripWatch never called)', async () => {
    const { bus, fire } = makeBus();
    let called = 0;
    const startWatch = {
      execute: async () => {
        called += 1;
        return { agentRunId: 'r', tripWatchId: 'w' };
      },
    } as unknown as StartTripWatchUseCase;
    const h = new TripItineraryWatchHandler(bus, cfg(false), startWatch);
    h.onApplicationBootstrap();
    await fire(PAYLOAD);
    expect(called).toBe(0);
  });

  it('onModuleDestroy unsubscribes (idempotent)', async () => {
    const { bus, unsubscribed } = makeBus();
    const startWatch = { execute: async () => ({}) } as unknown as StartTripWatchUseCase;
    const h = new TripItineraryWatchHandler(bus, cfg(true), startWatch);
    h.onApplicationBootstrap();
    await h.onModuleDestroy();
    await h.onModuleDestroy();
    expect(unsubscribed()).toBe(1);
  });
});
