/**
 * Login with email + password. On success, issues a fresh session.
 *
 * Deliberate uniform-rejection: wrong-email and wrong-password both
 * throw the same `UnauthorizedError` with the same code so attackers
 * can't enumerate registered addresses. We still verify a dummy
 * password hash on the miss-path to equalize timing (within a
 * reasonable tolerance — argon2 itself varies).
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { hashPassword, verifyPassword } from '@app/auth';
import { RateLimitError, UnauthorizedError } from '@app/errors';
import { createLogger } from '@app/logger';
import { isWellFormedBackupCode } from '../infrastructure/backup-code-hash';
import { TotpService } from '../infrastructure/totp.service';
import {
  IssueSessionUseCase,
  type IssueSessionCommand,
  type IssuedSession,
} from './issue-session.use-case';
import { BACKUP_CODE_REPOSITORY, type BackupCodeRepository } from './ports/backup-code.repository';
import { FAILED_LOGIN_COUNTER, type FailedLoginCounter } from './ports/failed-login-counter';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';
import { hashEmail } from '../infrastructure/email-hash';
import { mintReactivationToken } from '../../account/infrastructure/reactivation-token';

const log = createLogger('identity.login');

/**
 * Max failed-login attempts per identity within the window. OWASP
 * ASVS v4 v2.2.1 recommends ≥5 attempts before lockout (to avoid
 * locking legitimate users on genuine typos). We pick 5 exactly —
 * higher costs too much in credential-stuffing attempts per window.
 */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
  /**
   * Six-digit TOTP code. Required when the user has MFA enabled;
   * ignored otherwise. The controller passes whatever the client
   * sent; the use-case is the authority on whether it's needed.
   */
  readonly mfaCode?: string;
  readonly deviceContext: Omit<IssueSessionCommand, 'userId' | 'role'>;
}

/**
 * Precomputed-on-startup hash against which we "verify" when the user
 * doesn't exist — so the miss-path and the wrong-password path both
 * run an argon2 verify. Deliberate timing equalizer, not security.
 */
let DUMMY_HASH: string | null = null;
async function ensureDummyHash(): Promise<string> {
  if (DUMMY_HASH === null) {
    DUMMY_HASH = await hashPassword('not-a-real-password-used-for-timing-only');
  }
  return DUMMY_HASH;
}

/**
 * V.UX.33 — when login finds a soft-deleted user inside the
 * 7-day retention window AND the password matches, we throw
 * `AccountDeletionPendingError` instead of issuing a session.
 * The controller catches it + returns a 403-shaped response with
 * the reactivation token so the web client can route to
 * /account/reactivate.
 */
export class AccountDeletionPendingError extends UnauthorizedError {
  constructor(
    readonly reactivationToken: string,
    readonly retentionExpiresAt: Date,
  ) {
    super(
      'Account scheduled for deletion — restore within the retention window',
      {
        reactivationToken,
        retentionExpiresAt: retentionExpiresAt.toISOString(),
      },
      'ACCOUNT_DELETION_PENDING',
    );
  }
}

const RETENTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: BackupCodeRepository,
    @Inject(FAILED_LOGIN_COUNTER)
    private readonly failCounter: FailedLoginCounter,
    private readonly issueSession: IssueSessionUseCase,
    private readonly totp: TotpService,
  ) {}

  async execute(cmd: LoginCommand): Promise<IssuedSession & { userId: string }> {
    const emailHash = hashEmail(cmd.email.trim().toLowerCase());

    // Check lockout BEFORE any password verification — a locked-out
    // account gives the exact same response regardless of what the
    // attacker tries, and we don't want to burn argon2 cycles on
    // their flood of attempts.
    const state = await this.failCounter.get(emailHash);
    if (state.count >= MAX_FAILED_LOGIN_ATTEMPTS) {
      log.warn(
        { emailHash: emailHash.slice(0, 8), count: state.count, ttlMs: state.ttlMs },
        'login_locked_out',
      );
      throw new RateLimitError(
        'Account temporarily locked — too many failed login attempts',
        state.ttlMs,
        { lockoutMs: state.ttlMs },
        'ACCOUNT_LOCKED',
      );
    }

    // V.UX.33 — fetch the row INCLUDING soft-deleted state so we can
    // distinguish "wrong credentials" from "soft-deleted, still
    // recoverable". The active-user lookup that follows still uses
    // the deletedAt-filtered findByEmailHash so we don't accidentally
    // issue a session for a deleted account.
    const userIncludingDeleted = await this.users.findByEmailHashIncludingDeleted(emailHash);

    // Missing user OR password-less account: verify dummy to equalize
    // timing + increment counter (we don't want "no such email" to be
    // faster than "wrong password").
    if (!userIncludingDeleted || userIncludingDeleted.passwordHash === null) {
      await verifyPassword(cmd.password, await ensureDummyHash()).catch(() => false);
      await this.failCounter.increment(emailHash);
      throw new UnauthorizedError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
    }

    const ok = await verifyPassword(cmd.password, userIncludingDeleted.passwordHash);
    if (!ok) {
      await this.failCounter.increment(emailHash);
      throw new UnauthorizedError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
    }

    // V.UX.33 — soft-deleted within the 7-day window: surface the
    // reactivation challenge instead of issuing a session. We've
    // already verified the password, so handing back a reactivation
    // token is safe (proves possession of credentials).
    if (userIncludingDeleted.deletedAt !== null) {
      const ageMs = Date.now() - userIncludingDeleted.deletedAt.getTime();
      if (ageMs < RETENTION_WINDOW_MS) {
        const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;
        const token = mintReactivationToken(userIncludingDeleted.id, pepper);
        const retentionExpiresAt = new Date(
          userIncludingDeleted.deletedAt.getTime() + RETENTION_WINDOW_MS,
        );
        // Don't increment the failure counter — the credentials WERE
        // correct; only the account state blocks the sign-in.
        await this.failCounter.reset(emailHash);
        throw new AccountDeletionPendingError(token, retentionExpiresAt);
      }
      // Past 7 days: fall through to INVALID_CREDENTIALS so the row
      // looks identical to a never-existed account. (In practice the
      // AccountPurger should have hard-deleted by now; this is a
      // belt-and-suspenders guard if the cron lagged.)
      await this.failCounter.increment(emailHash);
      throw new UnauthorizedError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
    }

    const user = userIncludingDeleted;

    // MFA gate. Client flow:
    //   1. POST /login with just { email, password }. If the user
    //      has MFA, we return 401 `MFA_REQUIRED` — the client then
    //      prompts for the authenticator code OR a backup code.
    //   2. POST /login with { email, password, mfaCode }.
    //      - 6-digit input → try TOTP.
    //      - 8-char alphanumeric input → try backup code (single-use;
    //        consumed on success).
    //   3. On success the session issues normally.
    if (user.mfaEnabled) {
      if (!cmd.mfaCode) {
        throw new UnauthorizedError(
          'Multi-factor authentication code required',
          {},
          'MFA_REQUIRED',
        );
      }
      if (!user.mfaSecret) {
        // Invariant violation — `mfaEnabled` true with no secret means
        // the DB was tampered with. Fail closed.
        throw new UnauthorizedError('MFA misconfigured', {}, 'MFA_MISCONFIGURED');
      }

      const trimmedCode = cmd.mfaCode.trim().toUpperCase();
      let mfaAccepted = false;
      if (/^\d{6}$/.test(trimmedCode)) {
        mfaAccepted = this.totp.verifyCode(user.mfaSecret, trimmedCode);
      } else if (isWellFormedBackupCode(trimmedCode)) {
        mfaAccepted = await this.backupCodes.consume(user.id, trimmedCode);
        if (mfaAccepted) {
          const remaining = await this.backupCodes.countRemaining(user.id);
          log.warn({ userId: user.id, remaining }, 'mfa_backup_code_consumed');
        }
      }
      if (!mfaAccepted) {
        // MFA failure also counts against lockout — otherwise an
        // attacker with a leaked password could burn through every
        // 6-digit code unhindered.
        await this.failCounter.increment(emailHash);
        throw new UnauthorizedError('Invalid MFA code', {}, 'INVALID_MFA');
      }
    }

    // Successful login — clear the counter.
    await this.failCounter.reset(emailHash);

    const issued = await this.issueSession.execute({
      ...cmd.deviceContext,
      userId: user.id,
      role: user.role,
    });
    return { ...issued, userId: user.id };
  }
}
