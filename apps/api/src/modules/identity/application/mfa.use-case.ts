/**
 * Three MFA lifecycle use-cases:
 *   - `SetupMfaUseCase` — generate a fresh secret, stage it on the
 *     user row (without flipping `mfaEnabled`), return the
 *     provisioning URI for the client's QR renderer.
 *   - `VerifyMfaUseCase` — the user has scanned the QR and entered
 *     a code. On success, flip `mfaEnabled` to true.
 *   - `DisableMfaUseCase` — the user wants to turn MFA off. Requires
 *     a valid current code so a hijacked session can't silently
 *     strip the second factor.
 *
 * All three operate on a user already authenticated by the guard
 * chain — the caller is expected to pass the `userId` from
 * `req.user.sub`.
 *
 * Installed by prompt [III.13.2] part 4.
 */
import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError, ConflictError, NotFoundError } from '@app/errors';
import { TotpService } from '../infrastructure/totp.service';
import { BACKUP_CODE_REPOSITORY, type BackupCodeRepository } from './ports/backup-code.repository';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';

/** Number of backup codes issued per regeneration batch. */
export const BACKUP_CODE_COUNT = 10;

export interface SetupMfaResult {
  readonly base32: string;
  readonly otpauthUri: string;
  readonly alreadyEnabled: boolean;
}

@Injectable()
export class SetupMfaUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly totp: TotpService,
  ) {}

  async execute(userId: string): Promise<SetupMfaResult> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', { userId }, 'USER_NOT_FOUND');
    }
    if (user.mfaEnabled) {
      // Already confirmed — tell the client without re-issuing a
      // secret. Disabling first is a separate flow.
      throw new ConflictError('MFA already enabled', {}, 'MFA_ALREADY_ENABLED');
    }
    const label = user.id; // We don't decrypt the email here.
    const secret = this.totp.generateSecret(label);
    await this.users.setMfaSecret(userId, secret.base32);
    return {
      base32: secret.base32,
      otpauthUri: secret.otpauthUri,
      alreadyEnabled: false,
    };
  }
}

export interface VerifyMfaResult {
  /**
   * Freshly-generated plaintext backup codes, returned ONLY on the
   * transition that flips `mfaEnabled` from false → true. Null on
   * re-verifies of an already-enabled account (idempotent no-op).
   * Shown to the user once; never retrievable again.
   */
  readonly backupCodes: readonly string[] | null;
}

@Injectable()
export class VerifyMfaUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: BackupCodeRepository,
    private readonly totp: TotpService,
  ) {}

  async execute(userId: string, code: string): Promise<VerifyMfaResult> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', { userId }, 'USER_NOT_FOUND');
    }
    if (!user.mfaSecret) {
      // Client called /verify before /setup, or /setup silently failed.
      throw new UnauthorizedError('MFA setup must complete before verify', {}, 'MFA_NOT_STAGED');
    }
    if (!this.totp.verifyCode(user.mfaSecret, code)) {
      throw new UnauthorizedError('Invalid MFA code', {}, 'INVALID_MFA');
    }
    if (user.mfaEnabled) {
      // Re-verify is a no-op — don't rotate codes on idempotent calls.
      return { backupCodes: null };
    }
    await this.users.confirmMfa(userId);
    const plaintexts = await this.backupCodes.regenerate(userId, BACKUP_CODE_COUNT);
    return { backupCodes: plaintexts };
  }
}

@Injectable()
export class DisableMfaUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: BackupCodeRepository,
    private readonly totp: TotpService,
  ) {}

  async execute(userId: string, code: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', { userId }, 'USER_NOT_FOUND');
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      // Idempotent: disabling an already-disabled account succeeds
      // silently so the client's UX doesn't have to branch on state.
      // Still clear codes defensively — shouldn't be any but safe.
      await this.backupCodes.clearAll(userId);
      return;
    }
    if (!this.totp.verifyCode(user.mfaSecret, code)) {
      throw new UnauthorizedError('Invalid MFA code', {}, 'INVALID_MFA');
    }
    await this.users.disableMfa(userId);
    await this.backupCodes.clearAll(userId);
  }
}

/**
 * Regenerate the 10-code backup set. Requires a valid TOTP code so
 * a hijacked session can't silently rotate codes (which would lock
 * the legitimate user out of the recovery path). Returns the new
 * plaintexts — shown once, never again.
 */
@Injectable()
export class RegenerateBackupCodesUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodes: BackupCodeRepository,
    private readonly totp: TotpService,
  ) {}

  async execute(userId: string, code: string): Promise<readonly string[]> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', { userId }, 'USER_NOT_FOUND');
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedError(
        'MFA must be enabled before backup codes can be regenerated',
        {},
        'MFA_NOT_ENABLED',
      );
    }
    if (!this.totp.verifyCode(user.mfaSecret, code)) {
      throw new UnauthorizedError('Invalid MFA code', {}, 'INVALID_MFA');
    }
    return this.backupCodes.regenerate(userId, BACKUP_CODE_COUNT);
  }
}
