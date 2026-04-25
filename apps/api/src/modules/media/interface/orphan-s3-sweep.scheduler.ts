/**
 * Background tick that drives `OrphanS3SweepUseCase`. Mirrors the
 * lifecycle shape of `AccountPurgeScheduler` from `[IV.18.16.3]`:
 * plain `setInterval` inside `OnModuleInit`, skipped under
 * `NODE_ENV=test`, `.unref()` so it doesn't keep the prod process
 * alive past the HTTP server, `clearInterval` in
 * `onModuleDestroy` so Jest test processes don't leak handles.
 *
 * 24h interval matches `AccountPurgeScheduler` — this is a
 * compliance / housekeeping backstop, not a hot path. Bytes
 * leaking for up to a day after a takedown is fine; the DB row
 * is the only authed handle.
 *
 * Re-entrant guard prevents the next tick from stacking on top of
 * a still-running sweep. A long sweep stays "running" until done;
 * the next tick logs and skips.
 *
 * Installed by prompt [IV.18.18.5].
 */
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createLogger } from '@app/logger';
import { OrphanS3SweepUseCase } from '../application/orphan-s3-sweep.use-case';

const log = createLogger('media.orphan-s3-sweep.scheduler');
const TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OrphanS3SweepScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(OrphanS3SweepUseCase)
    private readonly sweepUc: OrphanS3SweepUseCase,
  ) {}

  onModuleInit(): void {
    if (process.env['NODE_ENV'] === 'test') {
      log.info('orphan_sweep_scheduler_skipped_in_test');
      return;
    }
    void this.runTick();
    this.timer = setInterval(() => void this.runTick(), TICK_INTERVAL_MS);
    this.timer.unref();
    log.info({ intervalMs: TICK_INTERVAL_MS }, 'orphan_sweep_scheduler_started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Public for tests + a future admin "force sweep" endpoint.
   * Re-entrant guard: a long sweep won't get stacked on itself
   * if the next tick fires while it's still running.
   */
  async runTick(): Promise<void> {
    if (this.running) {
      log.warn('orphan_sweep_tick_skipped_already_running');
      return;
    }
    this.running = true;
    try {
      const result = await this.sweepUc.execute();
      log.info(result, 'orphan_sweep_tick_done');
    } catch (err) {
      log.error({ err }, 'orphan_sweep_tick_failed');
    } finally {
      this.running = false;
    }
  }
}
