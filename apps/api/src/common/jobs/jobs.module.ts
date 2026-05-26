/**
 * Global `JobsService` provider ([Q3]).
 *
 * Single point through which apps/api enqueues jobs onto BullMQ queues.
 * Owns the Queue lifecycle: lazy-constructs each queue on first use,
 * tears them all down on `OnModuleDestroy` via `queue.close()`.
 *
 * Why `@Global()`: same rationale as `ClockModule` from [M2] — there's
 * exactly one queue producer per process, and per-feature variants
 * would be a smell. Inject `JobsService` directly in any use-case.
 *
 * Why NOT define a queue per Nest module: BullMQ Queue construction is
 * cheap (it's just an ioredis client + a key-prefix), but the
 * connection lifecycle isn't — we want one connection per Queue, one
 * Queue per logical work-stream, and one place that owns shutdown.
 *
 * Usage:
 *
 *     // In a use case:
 *     constructor(private readonly jobs: JobsService) {}
 *     async send(userId: string) {
 *       await this.jobs.enqueue('notifications', 'welcome-email', {
 *         userId, channel: 'email', template: 'welcome', vars: { ... },
 *       });
 *     }
 *
 * Tests override `JobsService` with a no-op via `overrideProvider`.
 *
 * Installed by [Q3] of the Scale-readiness 3→10 series.
 */
import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { makeQueue, type JobName, type JobPayloads, type Queue } from '@app/jobs';
import type { Env } from '@app/config';

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly queues = new Map<JobName, Queue<unknown>>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Enqueue a job onto the named queue. Lazy-constructs the Queue on
   * first call so apps that never enqueue (e.g. test-only AppModules)
   * don't open Redis connections.
   */
  async enqueue<N extends JobName>(
    queue: N,
    jobName: string,
    payload: JobPayloads[N],
  ): Promise<void> {
    const q = this.getOrCreate(queue);
    // BullMQ's `Queue<T>.add()` types `data` as `ExtractDataType<T, T>`
    // which fights TypeScript's distribution over our JobPayloads[N]
    // union. The public API guarantees the right shape — we cast
    // through `unknown` at the library boundary (NOT `as any`; that
    // would trip the fitness gate).
    const addFn = q.add as unknown as (name: string, data: JobPayloads[N]) => Promise<unknown>;
    await addFn(jobName, payload);
  }

  /**
   * Direct Queue handle — escape hatch for callers that need
   * `removeJob`, `getJobCounts`, or a specific JobsOptions override.
   */
  queueFor<N extends JobName>(name: N): Queue<JobPayloads[N]> {
    return this.getOrCreate(name) as Queue<JobPayloads[N]>;
  }

  /** Close every Queue on graceful shutdown — releases ioredis connections. */
  async onModuleDestroy(): Promise<void> {
    for (const [name, q] of this.queues) {
      try {
        await q.close();
      } catch {
        // Best-effort. The process is exiting; we don't want a stuck
        // close to wedge SIGTERM. Worker.close() in the consumer side
        // is the authoritative drain — the producer just stops
        // emitting new jobs and lets the consumer finish.
        void name;
      }
    }
    this.queues.clear();
  }

  private getOrCreate<N extends JobName>(name: N): Queue<JobPayloads[N]> {
    let q = this.queues.get(name) as Queue<JobPayloads[N]> | undefined;
    if (!q) {
      q = makeQueue(name, this.config.get('REDIS_URL', { infer: true }));
      this.queues.set(name, q as Queue<unknown>);
    }
    return q;
  }
}

@Global()
@Module({
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
