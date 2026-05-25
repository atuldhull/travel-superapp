/**
 * Identity module — register, login, refresh, logout. Clean-hex DI:
 *
 *   controller (interface)
 *     → use-cases (application)
 *       → ports (application)
 *         ← prisma adapters (infrastructure)    ← repos
 *         ← jwt-token adapter (infrastructure)  ← token service
 *
 * The `ConfigService` + `PrismaService` come in via `@Global()`
 * modules (`AppConfigModule`, `DbModule`) so we don't re-import them.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { forwardRef, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SYSTEM_CLOCK } from '@app/clock';
import type { Env } from '@app/config';
import { TripModule } from '../trip/trip.module';
import { ConsumeMagicLinkUseCase } from './application/consume-magic-link.use-case';
import { ConsumePasswordResetUseCase } from './application/consume-password-reset.use-case';
import { IssueSessionUseCase } from './application/issue-session.use-case';
import { JWT_KEYRING_STORE } from './application/ports/jwt-keyring.store';
import { LoginUseCase } from './application/login.use-case';
import { MarkOnboardingCompleteUseCase } from './application/mark-onboarding-complete.use-case';
import { MAGIC_LINK_TOKEN_REPOSITORY } from './application/ports/magic-link-token.repository';
import { MAILER_PORT } from '../../common/mailer/mailer.port';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './application/ports/password-reset-token.repository';
import { RequestMagicLinkUseCase } from './application/request-magic-link.use-case';
import { RequestLoginCodeUseCase } from './application/request-login-code.use-case';
import { ConsumeLoginCodeUseCase } from './application/consume-login-code.use-case';
import { LOGIN_CODE_REPOSITORY } from './application/ports/login-code.repository';
import { SMS_SENDER } from './application/ports/sms-sender.port';
import { RequestPasswordResetUseCase } from './application/request-password-reset.use-case';
import {
  DisableMfaUseCase,
  RegenerateBackupCodesUseCase,
  SetupMfaUseCase,
  VerifyMfaUseCase,
} from './application/mfa.use-case';
import { BACKUP_CODE_REPOSITORY } from './application/ports/backup-code.repository';
import { FAILED_LOGIN_COUNTER } from './application/ports/failed-login-counter';
import {
  OAUTH_PROVIDERS,
  type OAuthProvider,
  type OAuthProviderRegistry,
} from './application/ports/oauth-provider';
import { SESSION_REPOSITORY } from './application/ports/session.repository';
import { TOKEN_SERVICE } from './application/ports/token.service';
import { USER_REPOSITORY } from './application/ports/user.repository';
import { USER_OAUTH_IDENTITY_REPOSITORY } from './application/ports/user-oauth-identity.repository';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { RegisterUseCase } from './application/register.use-case';
import { RevokeSessionUseCase } from './application/revoke-session.use-case';
import { RotateJwksUseCase } from './application/rotate-jwks.use-case';
import { SignInWithOAuthUseCase } from './application/sign-in-with-oauth.use-case';
import { AppleOAuthProvider } from './infrastructure/apple-oauth-provider';
import { GoogleOAuthProvider } from './infrastructure/google-oauth-provider';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import { MockOAuthProvider } from './infrastructure/mock-oauth-provider';
import { PrismaBackupCodeRepository } from './infrastructure/prisma-backup-code.repository';
import { PrismaMagicLinkTokenRepository } from './infrastructure/prisma-magic-link-token.repository';
import { PrismaPasswordResetTokenRepository } from './infrastructure/prisma-password-reset-token.repository';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { PrismaUserOAuthIdentityRepository } from './infrastructure/prisma-user-oauth-identity.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { RedisFailedLoginCounter } from './infrastructure/redis-failed-login-counter';
import { RedisJwtKeyringStore } from './infrastructure/redis-jwt-keyring.store';
import { PrismaLoginCodeRepository } from './infrastructure/prisma-login-code.repository';
import { ResendMailerAdapter } from '../../common/mailer/resend-mailer.adapter';
import { StubMailerAdapter } from '../../common/mailer/stub-mailer.adapter';
import { StubSmsSenderAdapter } from './infrastructure/stub-sms-sender.adapter';
import { TwilioSmsSenderAdapter } from './infrastructure/twilio-sms-sender.adapter';
import { TotpService } from './infrastructure/totp.service';
import { TOTP_PORT } from './application/ports/totp.port';
import { AuthController } from './interface/auth.controller';
import { JwksAdminController } from './interface/jwks-admin.controller';

/**
 * Builds the OAuth provider registry at module init. Each real
 * provider registers only when its credentials are present in env
 * (so local dev without Google/Apple creds still boots clean).
 * `mock` registers only OUTSIDE production so it can't leak into a
 * live deployment. Tests don't need to override — they drive the
 * live `mock` adapter directly.
 */
const oauthProvidersFactory = {
  provide: OAUTH_PROVIDERS,
  inject: [ConfigService, MockOAuthProvider],
  useFactory: (
    config: ConfigService<Env, true>,
    mock: MockOAuthProvider,
  ): OAuthProviderRegistry => {
    const registry = new Map<string, OAuthProvider>();
    const env = config.get('NODE_ENV', { infer: true });
    if (env !== 'production') {
      registry.set('mock', mock);
    }
    const googleClientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
    if (googleClientId) {
      registry.set('google', new GoogleOAuthProvider(config));
    }
    const appleClientId = config.get('APPLE_CLIENT_ID', { infer: true });
    if (appleClientId) {
      registry.set('apple', new AppleOAuthProvider(config));
    }
    return { get: (name: string) => registry.get(name) };
  },
} satisfies Provider;

@Module({
  // Trip module exports `SeedSampleTripUseCase` so the auth controller
  // can offer a "Skip + seed sample" terminal in the onboarding flow
  // (V.UX.3). `forwardRef` because Trip already depends transitively
  // on Identity via the global JwtAuthGuard's User lookup — keeps the
  // dep cycle DI-resolvable.
  imports: [forwardRef(() => TripModule)],
  controllers: [AuthController, JwksAdminController],
  providers: [
    // Ports → adapters.
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: BACKUP_CODE_REPOSITORY, useClass: PrismaBackupCodeRepository },
    { provide: FAILED_LOGIN_COUNTER, useClass: RedisFailedLoginCounter },
    { provide: JWT_KEYRING_STORE, useClass: RedisJwtKeyringStore },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    {
      provide: USER_OAUTH_IDENTITY_REPOSITORY,
      useClass: PrismaUserOAuthIdentityRepository,
    },
    {
      provide: MAGIC_LINK_TOKEN_REPOSITORY,
      useClass: PrismaMagicLinkTokenRepository,
    },
    {
      provide: PASSWORD_RESET_TOKEN_REPOSITORY,
      useClass: PrismaPasswordResetTokenRepository,
    },
    // Mailer port — POST.3 wires Resend when RESEND_API_KEY is set;
    // otherwise falls back to the stub. ResendMailerAdapter is NOT
    // a registered provider — its constructor throws when the key
    // is absent and Nest would eagerly instantiate it. The factory
    // `new`s it directly so construction is gated on env presence.
    StubMailerAdapter,
    {
      provide: MAILER_PORT,
      inject: [ConfigService, StubMailerAdapter],
      useFactory: (config: ConfigService<Env, true>, stub: StubMailerAdapter) => {
        const apiKey = config.get('RESEND_API_KEY', { infer: true });
        if (apiKey) return new ResendMailerAdapter(config, SYSTEM_CLOCK);
        return stub;
      },
    },
    { provide: LOGIN_CODE_REPOSITORY, useClass: PrismaLoginCodeRepository },
    // SMS port — Twilio when fully configured, else the $0 stub
    // (logs the code; dev + CI never depend on a paid provider).
    // Same env-gated-construction pattern as the mailer.
    StubSmsSenderAdapter,
    {
      provide: SMS_SENDER,
      inject: [ConfigService, StubSmsSenderAdapter],
      useFactory: (config: ConfigService<Env, true>, stub: StubSmsSenderAdapter) => {
        const sid = config.get('TWILIO_ACCOUNT_SID', { infer: true });
        const token = config.get('TWILIO_AUTH_TOKEN', { infer: true });
        const from = config.get('TWILIO_FROM_NUMBER', { infer: true });
        if (sid && token && from) return new TwilioSmsSenderAdapter(config, SYSTEM_CLOCK);
        return stub;
      },
    },
    MockOAuthProvider,
    oauthProvidersFactory,
    { provide: TOTP_PORT, useClass: TotpService },
    // Use-cases.
    IssueSessionUseCase,
    RegisterUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    RevokeSessionUseCase,
    SetupMfaUseCase,
    VerifyMfaUseCase,
    DisableMfaUseCase,
    RegenerateBackupCodesUseCase,
    SignInWithOAuthUseCase,
    RequestMagicLinkUseCase,
    ConsumeMagicLinkUseCase,
    RequestLoginCodeUseCase,
    ConsumeLoginCodeUseCase,
    RequestPasswordResetUseCase,
    ConsumePasswordResetUseCase,
    MarkOnboardingCompleteUseCase,
    RotateJwksUseCase,
  ],
  exports: [
    SESSION_REPOSITORY,
    USER_REPOSITORY,
    TOKEN_SERVICE,
    JWT_KEYRING_STORE,
    RefreshSessionUseCase,
  ],
})
export class IdentityModule {}
