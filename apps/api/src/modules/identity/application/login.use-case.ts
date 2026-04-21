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

@Injectable()
export class LoginUseCase {
  constructor(
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

    const user = await this.users.findByEmailHash(emailHash);

    // Missing user: verify dummy to equalize timing + increment
    // counter anyway (we don't want "no such email" to be faster
    // than "wrong password" — both paths burn a failure slot).
    if (!user || user.passwordHash === null) {
      await verifyPassword(cmd.password, await ensureDummyHash()).catch(() => false);
      await this.failCounter.increment(emailHash);
      throw new UnauthorizedError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
    }

    const ok = await verifyPassword(cmd.password, user.passwordHash);
    if (!ok) {
      await this.failCounter.increment(emailHash);
      throw new UnauthorizedError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
    }

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
