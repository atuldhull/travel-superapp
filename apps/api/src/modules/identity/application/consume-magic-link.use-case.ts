/**
 * Consume a passwordless sign-in link. The token plaintext is sent
 * back from the client (it was the URL fragment in the email link).
 *
 * Resolution rules (mirrors `SignInWithOAuthUseCase`):
 *   1. Verify the token: must exist, be unconsumed, not expired,
 *      and the atomic `consume()` must win the single-use race.
 *      Failure → 401 `MAGIC_LINK_INVALID`.
 *   2. Look up the User by `emailHash`.
 *      - Existing → issue session for that user.
 *      - First-time → create a password-less User row (mirrors
 *        OAuth sign-up shape: nullable passwordHash) + issue
 *        session. The displayName defaults to "Traveler" — the
 *        user can edit it in /account once signed in.
 *
 * MFA: this slice does NOT step up to MFA on a magic-link sign-in.
 * If the user has MFA enabled, the magic link still issues a
 * session (security model: provider-verified email == possession of
 * mailbox == one factor; same posture as OAuth sign-in). A
 * `force-mfa-on-magic-link` flag is queued as a follow-up.
 *
 * The caller's plaintext token is hashed exactly like the request
 * use-case so the comparison happens entirely in hash-space (DB
 * column is the hash; no plaintext anywhere on disk).
 *
 * Installed by prompt [V.UX.2].
 */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '@app/errors';
import type { Env } from '@app/config';
import { ConfigService } from '@nestjs/config';
import {
  IssueSessionUseCase,
  type IssueSessionCommand,
  type IssuedSession,
} from './issue-session.use-case';
import {
  MAGIC_LINK_TOKEN_REPOSITORY,
  type MagicLinkTokenRepository,
} from './ports/magic-link-token.repository';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';

export interface ConsumeMagicLinkCommand {
  readonly token: string;
  readonly deviceContext: Omit<IssueSessionCommand, 'userId' | 'role'>;
}

export interface ConsumeMagicLinkResult extends IssuedSession {
  readonly userId: string;
  /** True iff this consume created a brand-new User row. UI can
   *  show an onboarding nudge on first sign-in (like OAuth). */
  readonly createdUser: boolean;
}

@Injectable()
export class ConsumeMagicLinkUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(MAGIC_LINK_TOKEN_REPOSITORY)
    private readonly tokens: MagicLinkTokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly issueSession: IssueSessionUseCase,
  ) {}

  async execute(cmd: ConsumeMagicLinkCommand): Promise<ConsumeMagicLinkResult> {
    const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;
    const tokenHash = createHash('sha256').update(`${pepper}${cmd.token}`).digest('hex');

    // Atomic single-use claim — wins iff: row exists, not consumed,
    // not expired. Wrong / consumed / expired all collapse to 401
    // MAGIC_LINK_INVALID (no information leak).
    const consumed = await this.tokens.consume(tokenHash, new Date());
    if (!consumed) {
      throw new UnauthorizedError('Magic link is invalid or expired', {}, 'MAGIC_LINK_INVALID');
    }

    let user = await this.users.findByEmailHash(consumed.emailHash);
    let createdUser = false;
    if (!user) {
      // First-time consumer — create a password-less account. We
      // don't have the plaintext email here (only the hash), so the
      // emailEncrypted column is left empty and displayName defaults
      // to "Traveler". The user can update both via /account once
      // signed in. Privacy-by-design: we never round-tripped the
      // plaintext to disk in any form.
      user = await this.users.create({
        emailHash: consumed.emailHash,
        emailEncrypted: Buffer.alloc(0),
        passwordHash: null,
        displayName: 'Traveler',
      });
      createdUser = true;
    }

    const issued = await this.issueSession.execute({
      ...cmd.deviceContext,
      userId: user.id,
      role: user.role,
    });
    return { ...issued, userId: user.id, createdUser };
  }
}
