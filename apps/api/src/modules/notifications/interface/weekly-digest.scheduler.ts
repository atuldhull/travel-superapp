/**
 * V.UX.26 — hourly tick that calls `SendWeeklyDigestUseCase`. The
 * use-case itself enforces the "Sunday 08:00 LOCAL, once per week"
 * cadence (per-user timezone + lastDigestSentAt window). The hourly
 * tick is just the wake-up source.
 *
 * Same shape as `KarmaRecomputeScheduler` (V.UX.25) — plain
 * `setInterval`; skipped in test env so Jest doesn't leak handles.
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createLogger } from '@app/logger';
import { SendWeeklyDigestUseCase } from '../application/send-weekly-digest.use-case';

const log = createLogger('notifications.weekly-digest.scheduler');
const TICK_INTERVAL_MS = 60 * 60 * 1000; // hourly

@Injectable()
export class WeeklyDigestScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(SendWeeklyDigestUseCase) private readonly digest: SendWeeklyDigestUseCase) {}

  onModuleInit(): void {
    if (process.env['NODE_ENV'] === 'test') {
      log.info('weekly_digest_scheduler_skipped_in_test');
      return;
    }
    this.timer = setInterval(() => void this.runTick(), TICK_INTERVAL_MS);
    this.timer.unref();
    log.info({ intervalMs: TICK_INTERVAL_MS }, 'weekly_digest_scheduler_started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runTick(): Promise<void> {
    if (this.running) {
      log.warn('weekly_digest_tick_skipped_already_running');
      return;
    }
    this.running = true;
    try {
      const { visited, sent } = await this.digest.execute();
      log.info({ visited, sent }, 'weekly_digest_tick_done');
    } catch (err) {
      log.error({ err }, 'weekly_digest_tick_failed');
    } finally {
      this.running = false;
    }
  }
}
