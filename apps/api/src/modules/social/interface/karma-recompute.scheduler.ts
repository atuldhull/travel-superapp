/**
 * V.UX.25 — nightly tick that calls `RecomputeKarmaUseCase`. Same
 * shape as `AccountPurgeScheduler` (V.UX.16-era) — plain
 * `setInterval` so we don't pull in `@nestjs/schedule`. Skipped in
 * test env so Jest doesn't leak handles.
 *
 * Failure isolation: any error inside the use-case is caught + logged.
 * The cast-helpful-vote inline recompute is the primary write path;
 * this sweep is a safety net.
 *
 * Installed by prompt [V.UX.25].
 */
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createLogger } from '@app/logger';
import { RecomputeKarmaUseCase } from '../application/recompute-karma.use-case';

const log = createLogger('social.karma.scheduler');
const TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class KarmaRecomputeScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(RecomputeKarmaUseCase) private readonly recompute: RecomputeKarmaUseCase) {}

  onModuleInit(): void {
    if (process.env['NODE_ENV'] === 'test') {
      log.info('karma_scheduler_skipped_in_test');
      return;
    }
    void this.runTick();
    this.timer = setInterval(() => void this.runTick(), TICK_INTERVAL_MS);
    this.timer.unref();
    log.info({ intervalMs: TICK_INTERVAL_MS }, 'karma_scheduler_started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runTick(): Promise<void> {
    if (this.running) {
      log.warn('karma_tick_skipped_already_running');
      return;
    }
    this.running = true;
    try {
      const { visited, changed } = await this.recompute.execute();
      log.info({ visited, changed }, 'karma_tick_done');
    } catch (err) {
      log.error({ err }, 'karma_tick_failed');
    } finally {
      this.running = false;
    }
  }
}
