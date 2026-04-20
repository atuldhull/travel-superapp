import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { createLogger } from '@app/logger';
import type { DomainEvent, DomainEventWire } from './event';
import type { EventBus, EventHandler, SubscribeOptions, Subscription } from './event-bus';

const log = createLogger('events.redis');

const DEFAULT_DEAD_LETTER_ATTEMPTS = 3;
const READ_BLOCK_MS = 5_000;
const READ_COUNT = 16;
const CONSUMER_NAME = `${process.pid}-${randomUUID().slice(0, 8)}`;

/**
 * Redis Streams implementation of the `EventBus` port. Production
 * adapter; the counterpart to `InMemoryEventBus` (tests).
 *
 * Per-event stream `<keyPrefix>:<eventName>` (e.g.
 * `travel-prod:events:Trip.TripDrafted`). Each consumer group reads
 * independently via `XREADGROUP`. Delivery is at-least-once;
 * handlers ack on success (`XACK`) or retry on failure; after
 * `deadLetterAfterAttempts` the event is `XADD`'d to the matching
 * `<stream>:dlq` stream and acked on the main stream so it doesn't
 * re-deliver.
 *
 * Shutdown flushes in-flight handlers then `quit()`s the Redis client.
 *
 * Installed by prompt [IV.18.1.9]. See [ADR-003](../../../docs/adr/ADR-003-event-backbone.md).
 */
export interface RedisStreamsEventBusOptions {
  readonly url: string;
  /**
   * Key prefix for every stream. Should include env so dev / staging
   * / prod don't cross-contaminate. e.g. `travel-dev:events:`.
   */
  readonly keyPrefix: string;
}

interface InternalSub {
  readonly eventName: string;
  readonly consumerGroup: string;
  readonly stream: string;
  readonly dlqStream: string;
  readonly deadLetterAfterAttempts: number;
  stop: boolean;
  readonly loop: Promise<void>;
}

export class RedisStreamsEventBus implements EventBus {
  /**
   * Separate connections for publish vs consume — `XREADGROUP BLOCK`
   * holds its connection for the full block window; sharing it with
   * publish would freeze all publishes during the block.
   */
  private readonly publisher: Redis;
  private readonly keyPrefix: string;
  private readonly consumers: InternalSub[] = [];
  private closed = false;

  constructor(opts: RedisStreamsEventBusOptions) {
    this.publisher = new Redis(opts.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
    this.publisher.on('error', (err) => {
      log.warn({ err: err.message }, 'event_bus_publisher_error');
    });
    this.keyPrefix = opts.keyPrefix.endsWith(':') ? opts.keyPrefix : `${opts.keyPrefix}:`;
  }

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    if (this.closed) throw new Error('RedisStreamsEventBus: already closed');
    await this.ensureConnected(this.publisher);
    const wire: DomainEventWire<TPayload> = {
      name: event.name,
      id: event.id,
      version: event.version,
      occurredAt: event.occurredAt.toISOString(),
      ...(event.traceId ? { traceId: event.traceId } : {}),
      payload: event.payload,
    };
    await this.publisher.xadd(this.streamOf(event.name), '*', 'data', JSON.stringify(wire));
  }

  subscribe<TPayload>(
    eventName: string,
    handler: EventHandler<TPayload>,
    options: SubscribeOptions = {},
  ): Subscription {
    if (this.closed) throw new Error('RedisStreamsEventBus: already closed');
    const consumerGroup = options.consumerGroup ?? `anon-${randomUUID().slice(0, 8)}`;
    const stream = this.streamOf(eventName);
    const dlqStream = `${stream}:dlq`;
    const deadLetterAfterAttempts = options.deadLetterAfterAttempts ?? DEFAULT_DEAD_LETTER_ATTEMPTS;

    const sub: InternalSub = {
      eventName,
      consumerGroup,
      stream,
      dlqStream,
      deadLetterAfterAttempts,
      stop: false,
      // placeholder — replaced below once we know `sub`.
      loop: Promise.resolve(),
    };

    const runner = this.runConsumer(sub, handler as EventHandler);
    // Assign the real loop (InternalSub is mutable here by design).
    (sub as { loop: Promise<void> }).loop = runner;
    this.consumers.push(sub);

    return {
      eventName,
      consumerGroup,
      unsubscribe: async () => {
        sub.stop = true;
        await sub.loop.catch(() => undefined);
      },
    };
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const sub of this.consumers) sub.stop = true;
    await Promise.all(this.consumers.map((s) => s.loop.catch(() => undefined)));
    try {
      await this.publisher.quit();
    } catch {
      /* already closed */
    }
  }

  // ───────────────────────────────────────────────────────────────

  private streamOf(eventName: string): string {
    return `${this.keyPrefix}${eventName}`;
  }

  private async ensureConnected(client: Redis): Promise<void> {
    const s = client.status;
    if (s === 'end' || s === 'close' || s === 'wait') {
      await client.connect();
    }
  }

  /** Long-running consumer loop. Exits when `sub.stop` flips true. */
  private async runConsumer(sub: InternalSub, handler: EventHandler): Promise<void> {
    // Each consumer owns its own connection — XREADGROUP BLOCK holds it.
    const client = this.publisher.duplicate();
    client.on('error', (err) => {
      log.warn(
        { err: err.message, stream: sub.stream, group: sub.consumerGroup },
        'event_bus_consumer_error',
      );
    });
    try {
      await this.ensureConnected(client);
      // MKSTREAM auto-creates the stream. BUSYGROUP is idempotent-fine.
      try {
        await client.xgroup('CREATE', sub.stream, sub.consumerGroup, '$', 'MKSTREAM');
      } catch (err) {
        if (!(err instanceof Error && /BUSYGROUP/.test(err.message))) throw err;
      }

      while (!sub.stop) {
        const reply = (await client.xreadgroup(
          'GROUP',
          sub.consumerGroup,
          CONSUMER_NAME,
          'COUNT',
          READ_COUNT,
          'BLOCK',
          READ_BLOCK_MS,
          'STREAMS',
          sub.stream,
          '>',
        )) as Array<[string, Array<[string, string[]]>]> | null;

        if (!reply) continue;

        for (const [, entries] of reply) {
          for (const [entryId, fields] of entries) {
            await this.handleEntry(client, sub, handler, entryId, fields);
          }
        }
      }
    } finally {
      try {
        await client.quit();
      } catch {
        /* already closed */
      }
    }
  }

  private async handleEntry(
    client: Redis,
    sub: InternalSub,
    handler: EventHandler,
    entryId: string,
    fields: string[],
  ): Promise<void> {
    const dataIdx = fields.indexOf('data');
    if (dataIdx === -1 || dataIdx + 1 >= fields.length) {
      log.warn({ entryId, stream: sub.stream }, 'event_bus_malformed_entry');
      await client.xack(sub.stream, sub.consumerGroup, entryId);
      return;
    }
    const raw = fields[dataIdx + 1]!;
    let event: DomainEvent;
    try {
      const wire = JSON.parse(raw) as { occurredAt: string; [k: string]: unknown };
      event = { ...wire, occurredAt: new Date(wire.occurredAt) } as DomainEvent;
    } catch (err) {
      log.warn(
        { entryId, err: err instanceof Error ? err.message : String(err) },
        'event_bus_parse_failed',
      );
      await client.xack(sub.stream, sub.consumerGroup, entryId);
      return;
    }

    let lastError = '';
    for (let attempt = 1; attempt <= sub.deadLetterAfterAttempts; attempt++) {
      try {
        await handler(event);
        await client.xack(sub.stream, sub.consumerGroup, entryId);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    // Dead-letter: preserve the raw wire payload + the failure
    // metadata alongside for postmortems. Ack on the main stream
    // AFTER the DLQ XADD succeeds — at-least-once into DLQ.
    await client.xadd(
      sub.dlqStream,
      '*',
      'data',
      raw,
      'consumerGroup',
      sub.consumerGroup,
      'attempts',
      String(sub.deadLetterAfterAttempts),
      'lastError',
      lastError,
      'originStream',
      sub.stream,
    );
    await client.xack(sub.stream, sub.consumerGroup, entryId);
    log.warn(
      {
        eventName: event.name,
        eventId: event.id,
        stream: sub.stream,
        group: sub.consumerGroup,
        attempts: sub.deadLetterAfterAttempts,
      },
      'event_bus_dead_lettered',
    );
  }
}
