/**
 * Unit tests for `InMemoryEventBus`. Pure in-process; no Redis, no
 * jest timeouts needed.
 *
 * Installed by prompt [IV.18.1.9].
 */
import { randomUUID } from 'node:crypto';
import type { DomainEvent } from '../src/event';
import { InMemoryEventBus } from '../src/in-memory-event-bus';

function makeEvent<T>(name: string, payload: T): DomainEvent<T> {
  return {
    name,
    id: randomUUID(),
    version: 1,
    occurredAt: new Date(),
    payload,
  };
}

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  afterEach(async () => {
    await bus.close();
  });

  it('delivers a published event to a single subscriber', async () => {
    const received: DomainEvent[] = [];
    bus.subscribe('Trip.TripDrafted', async (evt) => {
      received.push(evt);
    });

    const event = makeEvent('Trip.TripDrafted', { tripId: 't1', userId: 'u1' });
    await bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0]?.id).toBe(event.id);
    expect((received[0]?.payload as { tripId: string }).tripId).toBe('t1');
  });

  it('fans out to multiple consumer groups — each group receives independently', async () => {
    const notifications: DomainEvent[] = [];
    const analytics: DomainEvent[] = [];

    bus.subscribe('Trip.TripPublished', async (e) => void notifications.push(e), {
      consumerGroup: 'notifications',
    });
    bus.subscribe('Trip.TripPublished', async (e) => void analytics.push(e), {
      consumerGroup: 'analytics',
    });

    await bus.publish(makeEvent('Trip.TripPublished', { tripId: 't2' }));

    expect(notifications).toHaveLength(1);
    expect(analytics).toHaveLength(1);
  });

  it('unsubscribe stops further delivery to that subscription', async () => {
    const received: DomainEvent[] = [];
    const sub = bus.subscribe('Trip.TripDrafted', async (e) => void received.push(e), {
      consumerGroup: 'test',
    });

    await bus.publish(makeEvent('Trip.TripDrafted', { tripId: 't3' }));
    expect(received).toHaveLength(1);

    await sub.unsubscribe();
    await bus.publish(makeEvent('Trip.TripDrafted', { tripId: 't4' }));
    expect(received).toHaveLength(1); // still 1 — second publish not delivered
  });

  it('retries a failing handler up to `deadLetterAfterAttempts` then routes to DLQ', async () => {
    let attempts = 0;
    bus.subscribe(
      'Trip.TripDrafted',
      async () => {
        attempts += 1;
        throw new Error('boom');
      },
      { consumerGroup: 'notifications', deadLetterAfterAttempts: 3 },
    );

    await bus.publish(makeEvent('Trip.TripDrafted', { tripId: 't5' }));

    expect(attempts).toBe(3);
    const dlq = bus.drainDlq();
    expect(dlq).toHaveLength(1);
    expect(dlq[0]?.consumerGroup).toBe('notifications');
    expect(dlq[0]?.attempts).toBe(3);
    expect(dlq[0]?.lastError).toBe('boom');
    expect(dlq[0]?.event.name).toBe('Trip.TripDrafted');
  });

  it('publishing with no subscribers is a no-op (not an error)', async () => {
    await expect(
      bus.publish(makeEvent('Trip.TripDrafted', { tripId: 't6' })),
    ).resolves.not.toThrow();
  });

  it('publishing after close throws', async () => {
    await bus.close();
    await expect(bus.publish(makeEvent('Trip.TripDrafted', { tripId: 't7' }))).rejects.toThrow(
      /already closed/,
    );
  });
});
