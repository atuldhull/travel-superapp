/**
 * Integration tests for `RedisStreamsEventBus`. Requires Docker
 * Redis. Skips cleanly if Redis isn't reachable.
 *
 * Acceptance (from prompt [IV.18.1.9]):
 *   • Publisher/subscriber delivers across consumer groups (separate
 *     groups each receive the same event).
 *   • DLQ receives a forced-fail event.
 *
 * Installed by prompt [IV.18.1.9].
 */
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import type { DomainEvent } from '../src/event';
import { RedisStreamsEventBus } from '../src/redis-streams-event-bus';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://:redis_dev@localhost:6379';
// Unique per test run so parallel / repeat runs don't contaminate
// each other's stream state.
const KEY_PREFIX = `events-test-${process.pid}-${Date.now()}`;

function makeEvent<T>(name: string, payload: T): DomainEvent<T> {
  return {
    name,
    id: randomUUID(),
    version: 1,
    occurredAt: new Date(),
    payload,
  };
}

/** Wait until `predicate()` is truthy or `timeoutMs` elapses. */
async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5_000,
  stepMs = 50,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error('waitFor: timed out');
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

describe('RedisStreamsEventBus (integration, requires Docker Redis)', () => {
  let bus: RedisStreamsEventBus;
  let redisReachable = true;

  beforeAll(async () => {
    // Connectivity probe via a throwaway client — if Redis isn't up,
    // skip the whole suite with a warning.
    const probe = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await probe.connect();
      await probe.ping();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(
        `redis-streams-event-bus integration test: Redis not reachable (${message}). Skipping.`,
      );
      redisReachable = false;
    } finally {
      await probe.quit().catch(() => undefined);
    }
  });

  beforeEach(() => {
    bus = new RedisStreamsEventBus({
      url: REDIS_URL,
      keyPrefix: `${KEY_PREFIX}:${randomUUID().slice(0, 8)}:`,
    });
  });

  afterEach(async () => {
    await bus.close();
  });

  it('delivers one event to two different consumer groups', async () => {
    if (!redisReachable) return;

    const notifications: DomainEvent[] = [];
    const analytics: DomainEvent[] = [];

    bus.subscribe('Trip.TripPublished', async (e) => void notifications.push(e), {
      consumerGroup: 'notifications',
    });
    bus.subscribe('Trip.TripPublished', async (e) => void analytics.push(e), {
      consumerGroup: 'analytics',
    });

    // Tiny delay so both consumer loops have a chance to reach
    // XREADGROUP before we publish.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const event = makeEvent('Trip.TripPublished', { tripId: 't1' });
    await bus.publish(event);

    await waitFor(() => notifications.length === 1 && analytics.length === 1);
    expect(notifications[0]?.id).toBe(event.id);
    expect(analytics[0]?.id).toBe(event.id);
  });

  it('forced-fail event lands in the DLQ stream after 3 retries', async () => {
    if (!redisReachable) return;

    let attempts = 0;
    bus.subscribe(
      'Trip.TripDrafted',
      async () => {
        attempts += 1;
        throw new Error('forced-fail');
      },
      { consumerGroup: 'notifications', deadLetterAfterAttempts: 3 },
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    const event = makeEvent('Trip.TripDrafted', { tripId: 't2' });
    await bus.publish(event);

    await waitFor(() => attempts === 3);

    // Inspect the DLQ stream directly. The bus writes under
    // `<keyPrefix><eventName>:dlq`; our test's bus already has the
    // prefix set, so we compute the stream name the same way the
    // adapter does.
    const probe = new Redis(REDIS_URL);
    try {
      // The prefix used by THIS test's bus — reach into the private
      // via the known contract (`${keyPrefix}${eventName}`).
      const prefix = (bus as unknown as { keyPrefix: string }).keyPrefix;
      const dlqStream = `${prefix}Trip.TripDrafted:dlq`;
      await waitFor(async () => (await probe.xlen(dlqStream)) > 0);
      const entries = await probe.xrange(dlqStream, '-', '+');
      expect(entries.length).toBe(1);
      const fields = entries[0]![1];
      const attemptsIdx = fields.indexOf('attempts');
      const errorIdx = fields.indexOf('lastError');
      expect(fields[attemptsIdx + 1]).toBe('3');
      expect(fields[errorIdx + 1]).toBe('forced-fail');
    } finally {
      await probe.quit();
    }
  });

  it('competing consumers in the same group see each event only once', async () => {
    if (!redisReachable) return;

    // Two handlers in the SAME consumer group — Redis Streams's
    // competing-consumers semantics means each event goes to exactly
    // one of them.
    const byHandler = { a: [] as DomainEvent[], b: [] as DomainEvent[] };
    bus.subscribe('Trip.TripPublished', async (e) => void byHandler.a.push(e), {
      consumerGroup: 'one-group',
    });
    bus.subscribe('Trip.TripPublished', async (e) => void byHandler.b.push(e), {
      consumerGroup: 'one-group',
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Publish 4 events — total received across both handlers should
    // equal 4, with neither starved beyond reason. The exact split
    // depends on which consumer happens to be blocked at the moment
    // of XADD, so we only assert the TOTAL.
    for (let i = 0; i < 4; i++) {
      await bus.publish(makeEvent('Trip.TripPublished', { tripId: `t-${i}` }));
    }

    await waitFor(() => byHandler.a.length + byHandler.b.length === 4);
    expect(byHandler.a.length + byHandler.b.length).toBe(4);
  });
});
