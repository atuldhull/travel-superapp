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
import { UnauthorizedError } from '@app/errors';
import {
  IssueSessionUseCase,
  type IssueSessionCommand,
  type IssuedSession,
} from './issue-session.use-case';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';
import { hashEmail } from '../infrastructure/email-hash';

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
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
    private readonly issueSession: IssueSessionUseCase,
  ) {}

  async execute(cmd: LoginCommand): Promise<IssuedSession & { userId: string }> {
    const emailHash = hashEmail(cmd.email.trim().toLowerCase());
    const user = await this.users.findByEmailHash(emailHash);

    // Missing user: verify dummy to equalize timing, then uniform reject.
    if (!user || user.passwordHash === null) {
      await verifyPassword(cmd.password, await ensureDummyHash()).catch(() => false);
      throw new UnauthorizedError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
    }

    const ok = await verifyPassword(cmd.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Invalid credentials', {}, 'INVALID_CREDENTIALS');
    }

    const issued = await this.issueSession.execute({
      ...cmd.deviceContext,
      userId: user.id,
      role: user.role,
    });
    return { ...issued, userId: user.id };
  }
}
