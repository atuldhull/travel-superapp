/**
 * Right-to-erasure use case (GDPR Art. 17 / DPDP §12 / COPPA
 * parental delete).
 *
 *   - Sets `User.deletedAt = now()` on the caller's row.
 *   - Revokes ALL live sessions for the user atomically with the
 *     soft-delete (single Prisma transaction in the adapter).
 *   - V.UX.33 — sends an `account.deletion-pending` email with a
 *     7-day reactivation link. Single-use semantics come from the
 *     side effect: once `restoreUser` clears `deletedAt`, the
 *     reactivate route returns the same idempotent success.
 *
 * Inside the 7-day window login surfaces `ACCOUNT_DELETION_PENDING`
 * + a fresh reactivation token (V.UX.33 LoginUseCase change). Past
 * the window, the AccountPurger has hard-deleted the row and login
 * returns `INVALID_CREDENTIALS`.
 *
 * Installed by prompt [IV.18.16.2]. Email + reactivation token
 * added in [V.UX.33].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { UserNotFoundError } from '@app/errors';
import { createLogger } from '@app/logger';
import { ACCOUNT_DELETER, type AccountDeleter } from './ports/account-deleter';
import { MAILER_PORT, type MailerPort } from '../../identity/application/ports/mailer.port';
import { mintReactivationToken } from '../../../common/crypto/reactivation-token';

const log = createLogger('account.delete');

@Injectable()
export class DeleteAccountUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(ACCOUNT_DELETER) private readonly deleter: AccountDeleter,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
  ) {}

  async execute(userId: string): Promise<void> {
    const result = await this.deleter.softDeleteAndRevokeSessions(userId, new Date());
    if (!result.ok) throw new UserNotFoundError(userId);
    if (result.email !== null) {
      try {
        const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;
        const token = mintReactivationToken(userId, pepper);
        const webBaseUrl =
          (this.config.get('WEB_BASE_URL', { infer: true }) as string | undefined) ??
          'http://localhost:3001';
        const fromName =
          (this.config.get('EMAIL_FROM_NAME', { infer: true }) as string | undefined) ??
          'TravelSuperApp';
        const reactivateUrl = `${webBaseUrl.replace(/\/$/, '')}/account/reactivate?token=${encodeURIComponent(token)}`;
        await this.mailer.send({
          to: result.email,
          subject: `${fromName} account scheduled for deletion`,
          textBody:
            `Hi,\n\n` +
            `Your ${fromName} account is scheduled for deletion. We'll keep your data ` +
            `for 7 days in case you change your mind.\n\n` +
            `If this was a mistake, restore your account here (link expires in 7 days):\n` +
            `${reactivateUrl}\n\n` +
            `If you meant to delete, no action needed — we'll wipe everything after the window closes.\n`,
        });
      } catch (err) {
        // Email failure must NOT roll back the delete. Log + carry on.
        log.warn(
          { err: err instanceof Error ? err.message : String(err), userId },
          'deletion_pending_email_send_failed',
        );
      }
    }
  }
}
