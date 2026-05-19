/**
 * Passwordless sign-in — step 2 (B1/B2). Verify the 6-digit code and
 * issue a session, find-or-creating the user. Mirrors
 * ConsumeMagicLinkUseCase + SignInWithOAuthUseCase:
 *
 *   - wrong / expired / consumed / too-many-attempts all collapse to
 *     401 LOGIN_CODE_INVALID (no information leak);
 *   - email channel: destHash IS the User.emailHash, so reuse
 *     findByEmailHash / create (password-less, like magic-link);
 *   - phone channel: find-or-create by phoneHash (phone-only account).
 *
 * Installed for Phase 1 — Onboarding & Identity.
 */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '@app/errors';
import type { Env } from '@app/config';
import { ConfigService } from '@nestjs/config';
import type { LoginChannel } from '../domain/login-code.entity';
import {
  IssueSessionUseCase,
  type IssueSessionCommand,
  type IssuedSession,
} from './issue-session.use-case';
import { LOGIN_CODE_REPOSITORY, type LoginCodeRepository } from './ports/login-code.repository';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';
import { normalizeDestination } from './request-login-code.use-case';

const MAX_ATTEMPTS = 5;

export interface ConsumeLoginCodeCommand {
  readonly channel: LoginChannel;
  readonly destination: string;
  readonly code: string;
  readonly deviceContext: Omit<IssueSessionCommand, 'userId' | 'role'>;
}

export interface ConsumeLoginCodeResult extends IssuedSession {
  readonly userId: string;
  readonly createdUser: boolean;
}

@Injectable()
export class ConsumeLoginCodeUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(LOGIN_CODE_REPOSITORY) private readonly codes: LoginCodeRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly issueSession: IssueSessionUseCase,
  ) {}

  async execute(cmd: ConsumeLoginCodeCommand): Promise<ConsumeLoginCodeResult> {
    const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;
    const dest = normalizeDestination(cmd.channel, cmd.destination);
    const destHash = createHash('sha256').update(`${pepper}${dest}`).digest('hex');
    const codeHash = createHash('sha256').update(`${pepper}${cmd.code}`).digest('hex');

    const invalid = () =>
      new UnauthorizedError('Sign-in code is invalid or expired', {}, 'LOGIN_CODE_INVALID');

    const active = await this.codes.findActive(destHash);
    if (!active || active.channel !== cmd.channel || active.attempts >= MAX_ATTEMPTS) {
      throw invalid();
    }
    if (active.codeHash !== codeHash) {
      await this.codes.registerFailedAttempt(active.id);
      throw invalid();
    }
    const won = await this.codes.consume(active.id, new Date());
    if (!won) throw invalid();

    let userId: string;
    let role: IssueSessionCommand['role'];
    let createdUser = false;

    if (cmd.channel === 'email') {
      // destHash == sha256(pepper+email) == User.emailHash.
      let user = await this.users.findByEmailHash(destHash);
      if (!user) {
        user = await this.users.create({
          emailHash: destHash,
          emailEncrypted: Buffer.alloc(0),
          passwordHash: null,
          displayName: 'Traveler',
        });
        createdUser = true;
      }
      userId = user.id;
      role = user.role;
    } else {
      let user = await this.users.findByPhoneHash(destHash);
      if (!user) {
        user = await this.users.createPhoneUser({
          phoneHash: destHash,
          displayName: 'Traveler',
        });
        createdUser = true;
      }
      userId = user.id;
      role = user.role;
    }

    const issued = await this.issueSession.execute({
      ...cmd.deviceContext,
      userId,
      role,
    });
    return { ...issued, userId, createdUser };
  }
}
