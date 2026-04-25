/**
 * Daily tick that calls `PurgeSoftDeletedUsersUseCase`. Plain
 * `setInterval` rather than `@nestjs/schedule` — the package
 * isn't in deps and this slice doesn't justify pulling it in
 * (single-instance v1, no cron-syntax requirements). When the
 * deploy goes multi-instance OR the schedule needs cron syntax
 * (different times of day, weekday-only, etc.), swap in
 * `@nestjs/schedule` + `@Cron(...)` — the use-case + adapter
 * stay unchanged.
 *
 * Lifecycle:
 *   - `onModuleInit` → schedules the 24h interval, runs one tick
 *     immediately (so a deploy after a long downtime catches up
 *     on accumulated soft-deletes). The kick-off is fire-and-
 *     forget; await would block app boot.
 *   - `onModuleDestroy` → clears the interval so Jest test
 *     processes don't leak handles. **Critical** for the test
 *     suite: without this, every spec that imports `AppModule`
 *     leaves a 24h timer alive and Jest hangs at exit.
 *
 * Failure isolation: any error inside the use-case is caught
 * + logged, never propagated. A failed sweep becomes the next
 * day's bigger sweep — eventual consistency is the right
 * posture for a compliance backstop.
 *
 * Installed by prompt [IV.18.16.3].
 */
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createLogger } from '@app/logger';
import { PurgeSoftDeletedUsersUseCase } from '../application/purge-soft-deleted-users.use-case';

const log = createLogger('account.purge.scheduler');

/**
 * 24 hours, ms. A daily tick is fine: the retention window is 7
 * days, so a row's actual delete delay sits in [7d, 7d+24h] —
 * well within "reasonable timeframe" for compliance.
 */
const TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AccountPurgeScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PurgeSoftDeletedUsersUseCase)
    private readonly purgeUc: PurgeSoftDeletedUsersUseCase,
  ) {}

  onModuleInit(): void {
    // Skip the timer entirely in tests so Jest can exit cleanly.
    // The use-case is still injectable for tests that want to
    // call the purge directly.
    if (process.env['NODE_ENV'] === 'test') {
      log.info('purge_scheduler_skipped_in_test');
      return;
    }
    // Run one tick immediately, then every 24h. Kick-off is
    // fire-and-forget — awaiting would block boot for an
    // arbitrarily long DB roundtrip.
    void this.runTick();
    this.timer = setInterval(() => void this.runTick(), TICK_INTERVAL_MS);
    // `unref` so the timer doesn't keep a non-test Node process
    // alive past its other work; prod-process lifetime is
    // governed by the http server, not this timer.
    this.timer.unref();
    log.info({ intervalMs: TICK_INTERVAL_MS }, 'purge_scheduler_started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Public for the (rare) admin endpoint that wants to force a
   * sweep. Re-entrant guard: a long sweep won't get stacked on
   * itself if the next tick fires while it's still running.
   */
  async runTick(): Promise<void> {
    if (this.running) {
      log.warn('purge_tick_skipped_already_running');
      return;
    }
    this.running = true;
    try {
      const { purged } = await this.purgeUc.execute();
      log.info({ purged }, 'purge_tick_done');
    } catch (err) {
      log.error({ err }, 'purge_tick_failed');
    } finally {
      this.running = false;
    }
  }
}
