/**
 * Sign in (or sign up) using an external OAuth provider's ID token.
 *
 * Three-stage user resolution:
 *   1. **Existing link**: `(provider, providerUserId)` already maps
 *      to a User → issue a session for that User. Most common path.
 *   2. **Email match, no link**: `(provider, providerUserId)` new but
 *      the verified email matches an existing password user →
 *      auto-link (`linkedAt = now`) + issue session. This is the
 *      "sign in with Google" experience for users who originally
 *      registered with email + password.
 *   3. **No user found**: create a new User (password-less) + link
 *      the identity + issue session.
 *
 * Why email-based auto-linking is safe: the provider has already
 * verified the email on its side (adapters enforce `email_verified`
 * before returning a profile). An attacker who owns the Google
 * account for `foo@bar.com` legitimately IS the owner of that
 * address. If we ever surface "add password" for OAuth-only
 * accounts, the same email gate applies there too.
 *
 * What we're NOT doing in this slice:
 *   - Multi-provider linking (e.g., a user with both Google + Apple).
 *   - Unlinking.
 *   - Forced-MFA-on-first-link.
 *   - Apple-specific first-sign-in name capture.
 * Each lands as its own follow-up.
 *
 * Installed by prompt [III.13.2.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '@app/errors';
import {
  IssueSessionUseCase,
  type IssueSessionCommand,
  type IssuedSession,
} from './issue-session.use-case';
import { OAUTH_PROVIDERS, type OAuthProviderRegistry } from './ports/oauth-provider';
import { USER_REPOSITORY, type UserRepository, type UserRecord } from './ports/user.repository';
import {
  USER_OAUTH_IDENTITY_REPOSITORY,
  type UserOAuthIdentityRepository,
} from './ports/user-oauth-identity.repository';
import { hashEmail } from '../infrastructure/email-hash';

export interface SignInWithOAuthCommand {
  readonly provider: string;
  readonly idToken: string;
  readonly deviceContext: Omit<IssueSessionCommand, 'userId' | 'role'>;
}

export interface OAuthSignInResult extends IssuedSession {
  readonly userId: string;
  /** True iff this sign-in created a brand-new User row. UI can show
   *  an onboarding nudge on first sign-in. */
  readonly createdUser: boolean;
  /** True iff a pre-existing password user was just linked to this
   *  OAuth provider for the first time (auto-link by email). */
  readonly linkedExisting: boolean;
}

@Injectable()
export class SignInWithOAuthUseCase {
  constructor(
    @Inject(OAUTH_PROVIDERS) private readonly providers: OAuthProviderRegistry,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_OAUTH_IDENTITY_REPOSITORY)
    private readonly identities: UserOAuthIdentityRepository,
    private readonly issueSession: IssueSessionUseCase,
  ) {}

  async execute(cmd: SignInWithOAuthCommand): Promise<OAuthSignInResult> {
    const adapter = this.providers.get(cmd.provider);
    if (!adapter) {
      throw new UnauthorizedError(
        `Unknown OAuth provider: ${cmd.provider}`,
        { provider: cmd.provider },
        'OAUTH_PROVIDER_UNKNOWN',
      );
    }

    // Adapter throws `UnauthorizedError` on signature / claim failures
    // — we let those propagate as-is (same 401 the user-facing
    // handler returns for a bad password).
    const profile = await adapter.verifyIdToken(cmd.idToken);
    const email = profile.email.toLowerCase();

    // 1. Existing link? Fast path.
    const existingLink = await this.identities.findByProviderUser(
      profile.provider,
      profile.providerUserId,
    );
    if (existingLink) {
      const user = await this.users.findById(existingLink.userId);
      if (!user) {
        // Link row exists but user row is gone — cascade didn't fire
        // or direct SQL tampered. Treat as auth failure.
        throw new UnauthorizedError(
          'OAuth identity orphaned',
          { userId: existingLink.userId },
          'OAUTH_IDENTITY_ORPHANED',
        );
      }
      const issued = await this.sessionFor(user, cmd.deviceContext);
      return { ...issued, userId: user.id, createdUser: false, linkedExisting: false };
    }

    // 2. No link yet — is there an existing user with this email?
    const emailHash = hashEmail(email);
    const byEmail = await this.users.findByEmailHash(emailHash);

    if (byEmail) {
      await this.identities.link({
        userId: byEmail.id,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        providerEmail: email,
      });
      const issued = await this.sessionFor(byEmail, cmd.deviceContext);
      return { ...issued, userId: byEmail.id, createdUser: false, linkedExisting: true };
    }

    // 3. First-time user — create password-less + link + issue.
    const displayName =
      profile.displayName && profile.displayName.length > 0
        ? profile.displayName
        : email.split('@')[0]!;
    const created = await this.users.create({
      emailHash,
      emailEncrypted: Buffer.from(email, 'utf8'),
      passwordHash: null,
      displayName,
    });
    await this.identities.link({
      userId: created.id,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      providerEmail: email,
    });
    const issued = await this.sessionFor(created, cmd.deviceContext);
    return { ...issued, userId: created.id, createdUser: true, linkedExisting: false };
  }

  private sessionFor(
    user: UserRecord,
    deviceContext: SignInWithOAuthCommand['deviceContext'],
  ): Promise<IssuedSession> {
    return this.issueSession.execute({
      ...deviceContext,
      userId: user.id,
      role: user.role,
    });
  }
}
