/**
 * V.UX.31 — consume a password-reset token + set a new password.
 * The new password is hashed via `@app/auth.hashPassword` (argon2id)
 * before persisting; the User row's existing hash is overwritten.
 *
 * Failure modes:
 *   - 401 `RESET_TOKEN_INVALID` — token missing/expired/already
 *     consumed (single signal, no enumeration leak).
 *   - 422 `WEAK_PASSWORD` — surface the same complexity rule as
 *     register (12..128 chars). The full Zod schema enforces this
 *     at the controller before the use-case runs; this layer is a
 *     defence-in-depth guard.
 *
 * On success, all of the user's active sessions stay valid — this
 * matches OWASP guidance ("session invalidation on password change
 * is a UX trade-off; we let the user pick a session-revoke action
 * separately"). A future flag could opt into nuke-all-sessions on
 * reset.
 *
 * Installed by prompt [V.UX.31].
 */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { hashPassword } from '@app/auth';
import { UnauthorizedError, ValidationError } from '@app/errors';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { CLOCK, type Clock } from '@app/clock';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepository,
} from './ports/password-reset-token.repository';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';

export interface ConsumePasswordResetCommand {
  readonly token: string;
  readonly newPassword: string;
}

const MIN_PASSWORD_LEN = 12;
const MAX_PASSWORD_LEN = 128;

@Injectable()
export class ConsumePasswordResetUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: ConsumePasswordResetCommand): Promise<void> {
    if (cmd.newPassword.length < MIN_PASSWORD_LEN || cmd.newPassword.length > MAX_PASSWORD_LEN) {
      throw new ValidationError(
        `Password must be ${MIN_PASSWORD_LEN}..${MAX_PASSWORD_LEN} characters`,
        { newPassword: [`Must be ${MIN_PASSWORD_LEN}..${MAX_PASSWORD_LEN} characters`] },
        { min: MIN_PASSWORD_LEN, max: MAX_PASSWORD_LEN },
        'WEAK_PASSWORD',
      );
    }

    const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;
    const tokenHash = createHash('sha256').update(`${pepper}${cmd.token}`).digest('hex');

    const consumed = await this.tokens.consume(tokenHash, this.clock.now());
    if (!consumed) {
      throw new UnauthorizedError(
        'Password reset link is invalid or expired',
        {},
        'RESET_TOKEN_INVALID',
      );
    }

    const user = await this.users.findByEmailHash(consumed.emailHash);
    if (!user) {
      // Token was minted for an email that no longer maps to a user
      // (account deleted between request and consume). Single signal
      // — same code as the missing-token path so the attacker can't
      // distinguish.
      throw new UnauthorizedError(
        'Password reset link is invalid or expired',
        {},
        'RESET_TOKEN_INVALID',
      );
    }

    const newHash = await hashPassword(cmd.newPassword);
    await this.users.setPasswordHash(user.id, newHash);
  }
}
