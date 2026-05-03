/**
 * V.UX.30 — daily tick that calls `AutoArchiveOldTripsUseCase` to
 * stamp `archivedAt = now()` on every trip whose `createdAt` is older
 * than 365 days. Same shape as `AccountPurgeScheduler` (V.UX.16-era)
 * + `KarmaRecomputeScheduler` (V.UX.25): plain `setInterval`,
 * skipped in test env so Jest doesn't leak handles.
 *
 * Installed by prompt [V.UX.30].
 */
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createLogger } from '@app/logger';
import { AutoArchiveOldTripsUseCase } from '../application/auto-archive-old-trips.use-case';

const log = createLogger('trip.auto-archive.scheduler');
const TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AutoArchiveTripsScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(AutoArchiveOldTripsUseCase)
    private readonly autoArchive: AutoArchiveOldTripsUseCase,
  ) {}

  onModuleInit(): void {
    if (process.env['NODE_ENV'] === 'test') {
      log.info('auto_archive_scheduler_skipped_in_test');
      return;
    }
    void this.runTick();
    this.timer = setInterval(() => void this.runTick(), TICK_INTERVAL_MS);
    this.timer.unref();
    log.info({ intervalMs: TICK_INTERVAL_MS }, 'auto_archive_scheduler_started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runTick(): Promise<void> {
    if (this.running) {
      log.warn('auto_archive_tick_skipped_already_running');
      return;
    }
    this.running = true;
    try {
      const { archived, cutoff } = await this.autoArchive.execute();
      log.info({ archived, cutoff }, 'auto_archive_tick_done');
    } catch (err) {
      log.error({ err }, 'auto_archive_tick_failed');
    } finally {
      this.running = false;
    }
  }
}
