/**
 * Sweep soft-deleted user rows that have aged past the
 * retention window. Pairs with the soft-delete flow shipped in
 * `[IV.18.16.2]` to complete the GDPR Art. 17 / DPDP §12
 * right-to-erasure story.
 *
 * Retention window is 7 days by default — long enough that a
 * user who hits "delete" by mistake can support-recover; short
 * enough to satisfy "delete within reasonable timeframe".
 * Configurable per-call via `retentionDays` for tests.
 *
 * Returns `{ purged: <count> }`. The scheduler logs the count
 * on every tick so an oncall has a clean signal — sudden spike
 * implies mass account-delete event; sudden zero implies the
 * cron has died.
 *
 * Installed by prompt [IV.18.16.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_RETENTION_DAYS } from '../../../common/policy/retention-policy';
import { ACCOUNT_PURGER, type AccountPurger } from './ports/account-purger';

export interface PurgeSoftDeletedUsersCommand {
  /** Override for tests; defaults to `DEFAULT_RETENTION_DAYS` (7). */
  readonly retentionDays?: number;
  /** Override for tests so they don't depend on `Date.now()`. */
  readonly now?: Date;
}

@Injectable()
export class PurgeSoftDeletedUsersUseCase {
  constructor(@Inject(ACCOUNT_PURGER) private readonly purger: AccountPurger) {}

  async execute(cmd: PurgeSoftDeletedUsersCommand = {}): Promise<{ purged: number }> {
    const retentionDays = cmd.retentionDays ?? DEFAULT_RETENTION_DAYS;
    const now = cmd.now ?? new Date();
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const purged = await this.purger.purgeOlderThan(cutoff);
    return { purged };
  }
}
