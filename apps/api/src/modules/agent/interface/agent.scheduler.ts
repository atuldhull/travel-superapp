/**
 * POST.2A.3 — the agent loop's cadence + concurrency skeleton.
 *
 * Plain `setInterval` (no @nestjs/schedule — not in deps; verified
 * codebase convention, copies AccountPurgeScheduler exactly). Each
 * tick lists active watches and, under a per-watch Redis lock
 * (`SET … NX EX`), runs RunWatchCycleUseCase for that watch. The
 * lock makes the loop safe if the deploy ever goes multi-instance
 * (no two ticks double-handle one watch).
 *
 * This file is intentionally a THIN cadence+lock shell: all the
 * real agent↔trip wiring (resolve context → trip-end ⇒ draft the
 * Memory Book + close, or signal ⇒ propose) lives in
 * RunWatchCycleUseCase and is unit-tested with fakes (no Redis, no
 * interval, no DB). A per-watch cycle failure is isolated so one bad
 * trip never stalls the loop.
 *
 * LAW 1: skipped entirely in tests + degrades silently; no external
 * call here. Installed by prompt [POST.2A.3].
 */
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { createLogger, type AppLogger } from '@app/logger';
import Redis from 'ioredis';
import {
  TRIP_WATCH_REPOSITORY,
  type TripWatchRepository,
} from '../application/ports/trip-watch.repository';
import { RunWatchCycleUseCase } from '../application/run-watch-cycle.use-case';

const LOCK_TTL_SECONDS = 60;

/** Minimal structural contract for the lock — satisfied by the real
 *  ioredis client AND a trivial fake (ioredis's overloaded `set`
 *  type is otherwise un-fakeable in a unit test). */
export interface WatchLockRedis {
  set(
    key: string,
    value: string,
    exFlag: 'EX',
    ttlSeconds: number,
    nxFlag: 'NX',
  ): Promise<string | null>;
}

/** Pure: acquire a per-watch lock via SET NX EX. Extracted so the
 *  race can be unit-tested with a fake redis (no real server). */
export async function acquireWatchLock(
  redis: WatchLockRedis,
  watchId: string,
  ttlSeconds: number = LOCK_TTL_SECONDS,
): Promise<boolean> {
  const res = await redis.set(`lock:agent:watch:${watchId}`, '1', 'EX', ttlSeconds, 'NX');
  return res === 'OK';
}

@Injectable()
export class AgentScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger: AppLogger = createLogger('agent.scheduler');
  private readonly redis: Redis;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(TRIP_WATCH_REPOSITORY) private readonly watches: TripWatchRepository,
    @Inject(RunWatchCycleUseCase) private readonly cycle: RunWatchCycleUseCase,
  ) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      this.logger.warn({ err: err.message }, 'agent_redis_error');
    });
    this.intervalMs = config.get('AGENT_TICK_INTERVAL_MS', { infer: true });
  }

  onModuleInit(): void {
    if (process.env['NODE_ENV'] === 'test') {
      this.logger.info({}, 'agent_scheduler_skipped_in_test');
      return;
    }
    void this.runTick();
    this.timer = setInterval(() => void this.runTick(), this.intervalMs);
    this.timer.unref();
    this.logger.info({ intervalMs: this.intervalMs }, 'agent_scheduler_started');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try {
      await this.redis.quit();
    } catch (err) {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'agent_redis_close_failed',
      );
    }
  }

  /** Re-entrant-guarded; public so a future admin endpoint can force
   *  a tick. Never throws — a failed tick is the next tick's work. */
  async runTick(): Promise<void> {
    if (this.running) {
      this.logger.warn({}, 'agent_tick_skipped_already_running');
      return;
    }
    this.running = true;
    try {
      const active = await this.watches.listActive();
      let handled = 0;
      for (const watch of active) {
        const locked = await acquireWatchLock(this.redis, watch.id);
        if (!locked) continue;
        // The real cycle: resolve trip context → end⇒draft+close, or
        // signal⇒propose. Per-watch failures are isolated so one bad
        // trip can't stall the rest of the loop (LAW 1).
        try {
          const res = await this.cycle.execute(watch);
          this.logger.info(
            { watchId: watch.id, tripId: watch.tripId, outcome: res.outcome },
            'agent_watch_cycle_done',
          );
        } catch (err) {
          this.logger.error(
            {
              watchId: watch.id,
              tripId: watch.tripId,
              err: err instanceof Error ? err.message : String(err),
            },
            'agent_watch_cycle_failed',
          );
        }
        handled += 1;
      }
      this.logger.info({ active: active.length, handled }, 'agent_tick_done');
    } catch (err) {
      this.logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'agent_tick_failed',
      );
    } finally {
      this.running = false;
    }
  }
}
