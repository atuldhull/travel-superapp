/**
 * Admin force-purge endpoint. Wraps `AccountPurgeScheduler.runTick()`
 * — the same method the daily `setInterval` calls.
 *
 *   POST /api/v1/admin/account-purge → { ok: true }
 *
 * Useful when:
 *   - retention rules change and ops wants to apply them immediately
 *     (don't wait 24h for the next tick);
 *   - oncall wants to confirm the purger is alive end-to-end after a
 *     deploy;
 *   - a privacy incident requires accelerated cleanup of accounts
 *     soft-deleted moments ago (the use-case still applies the 7-day
 *     retention window — this endpoint only fires the sweep, not the
 *     retention math).
 *
 * The scheduler's `runTick` has a re-entrant guard, so concurrent
 * calls don't stack. A second call while the first is still running
 * returns immediately (logged as `purge_tick_skipped_already_running`)
 * and this controller returns `{ ok: true }` regardless — the
 * operation is idempotent in effect.
 *
 * Class-level `@Roles('admin')`. Lives in Account module per the
 * admin-in-owning-module pattern.
 *
 * Installed by prompt [IV.18.18.2].
 */
import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '../../../common/auth';
import { AccountPurgeScheduler } from './account-purge.scheduler';

@Controller('admin/account-purge')
@Roles('admin')
export class AdminPurgeController {
  constructor(private readonly scheduler: AccountPurgeScheduler) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async forcePurge(): Promise<{ ok: true }> {
    await this.scheduler.runTick();
    return { ok: true };
  }
}
