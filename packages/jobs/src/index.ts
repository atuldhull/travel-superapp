/**
 * @app/jobs — typed BullMQ Queue + Worker factories.
 *
 * Why this package:
 *   - Move heavy / bursty work (push fan-out, email send, image variant
 *     generation, place re-crawl, memory-book PDF) OFF the request path.
 *     The api enqueues; a dedicated worker drains.
 *   - Centralise the cluster-safe key prefix (BullMQ uses `{<name>}` to
 *     pin a queue's keys to one Redis slot — see [Q2] runbook).
 *   - One ioredis connection per worker (BullMQ default), with the
 *     `maxRetriesPerRequest: null` setting BullMQ insists on.
 *   - OnModuleDestroy / Worker.close() invariants enforced via the
 *     architecture.fitness shutdown gate from [M1].
 *
 * Producer (apps/api):
 *
 *   const queue = makeQueue<NotificationDispatch>('notifications', redisUrl);
 *   await queue.add('email', { userId, template, vars });
 *
 * Consumer (apps/notification-worker):
 *
 *   const worker = makeWorker<NotificationDispatch>('notifications', {
 *     redisUrl,
 *     handler: async (job) => { await sendEmail(job.data); },
 *     concurrency: 10,
 *   });
 *   // worker.close() on process shutdown.
 *
 * Installed by [Q3] of the Scale-readiness 3→10 series.
 */

import { Queue, QueueEvents, Worker, type Processor } from 'bullmq';
import IORedis, { type RedisOptions } from 'ioredis';

/**
 * Registry of job names that exist in the system. Adding a new queue =
 * adding a row here. Stays a discriminated map so the producer + consumer
 * type-check end-to-end.
 *
 * One process owns the producer side (apps/api) and one or more processes
 * own the consumer side (apps/notification-worker, etc.); both import
 * from this file so a payload-shape change breaks the consumer at compile
 * time, not at runtime in prod.
 */
export interface JobPayloads {
  /** Notification fan-out — push / email / SMS routed by `channel`. */
  notifications: {
    userId: string;
    channel: 'push' | 'email' | 'sms';
    template: string;
    vars: Record<string, string | number | boolean | null>;
  };
  /** Media variant pipeline — Sharp generates avif/webp/thumb. */
  'media-variants': {
    assetId: string;
    sourceKey: string;
  };
  /** Crawler re-crawl on a schedule. */
  'crawler-recrawl': {
    placeId: string;
    reason: 'scheduled' | 'event-triggered';
  };
}

/** Queue names — derived from JobPayloads so adding a row keeps the world consistent. */
export type JobName = keyof JobPayloads;

/** Sensible defaults for a job — retries with exponential backoff, age-out long-stuck. */
export const DEFAULT_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 1_000 },
  removeOnComplete: { age: 24 * 3600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/** BullMQ connection options — keep in one place so producer + consumer match. */
export function buildRedisConnection(redisUrl: string): RedisOptions {
  // BullMQ insists `maxRetriesPerRequest: null` so blocking commands
  // (BRPOPLPUSH, etc.) don't time out under transient network blips.
  // We do NOT pass an existing ioredis instance — letting BullMQ own
  // the connection lifecycle keeps shutdown semantics clean (one
  // `.close()` per worker, no "connection ended unexpectedly" log
  // spam during graceful exit).
  // Parse the URL minimally to extract host / port / password / db.
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

/**
 * Build a typed Queue. Caller owns the lifecycle — call `.close()` on
 * shutdown. The fitness gate from [M1] verifies every Queue-owning
 * Nest provider implements OnModuleDestroy.
 */
export function makeQueue<N extends JobName>(name: N, redisUrl: string): Queue<JobPayloads[N]> {
  return new Queue<JobPayloads[N]>(name, {
    connection: buildRedisConnection(redisUrl),
    defaultJobOptions: DEFAULT_JOB_OPTS,
  });
}

export interface MakeWorkerOptions<N extends JobName> {
  redisUrl: string;
  /**
   * Job handler — return success or throw to retry.
   *
   * Signature uses BullMQ's open `Processor<T, any, string>` because
   * BullMQ's Job carries a string `name` field at runtime regardless of
   * our typed `JobName` registry — narrowing it on the client side
   * fights the library. Callers receive `job.data` as the typed payload.
   */
  handler: Processor<JobPayloads[N], unknown, string>;
  /** Per-worker concurrency. Default 1 (serial). Tune per workload. */
  concurrency?: number;
  /** Auto-run on construct. Default true — same as BullMQ default. */
  autorun?: boolean;
}

/**
 * Build a typed Worker. Caller owns the lifecycle — call `.close()` on
 * shutdown so in-flight jobs finish cleanly + the connection releases.
 */
export function makeWorker<N extends JobName>(
  name: N,
  opts: MakeWorkerOptions<N>,
): Worker<JobPayloads[N]> {
  return new Worker<JobPayloads[N]>(name, opts.handler, {
    connection: buildRedisConnection(opts.redisUrl),
    concurrency: opts.concurrency ?? 1,
    autorun: opts.autorun ?? true,
  });
}

/**
 * Build a QueueEvents listener — useful when the producer wants to know
 * "did the worker complete this job?" without polling. One per queue.
 */
export function makeQueueEvents<N extends JobName>(name: N, redisUrl: string): QueueEvents {
  return new QueueEvents(name, {
    connection: buildRedisConnection(redisUrl),
  });
}

export type { Queue, Worker, QueueEvents, Processor };
