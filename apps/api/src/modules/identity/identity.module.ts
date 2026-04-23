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
import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { IssueSessionUseCase } from './application/issue-session.use-case';
import { LoginUseCase } from './application/login.use-case';
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
import { SignInWithOAuthUseCase } from './application/sign-in-with-oauth.use-case';
import { AppleOAuthProvider } from './infrastructure/apple-oauth-provider';
import { GoogleOAuthProvider } from './infrastructure/google-oauth-provider';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import { MockOAuthProvider } from './infrastructure/mock-oauth-provider';
import { PrismaBackupCodeRepository } from './infrastructure/prisma-backup-code.repository';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { PrismaUserOAuthIdentityRepository } from './infrastructure/prisma-user-oauth-identity.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { RedisFailedLoginCounter } from './infrastructure/redis-failed-login-counter';
import { TotpService } from './infrastructure/totp.service';
import { AuthController } from './interface/auth.controller';

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
  controllers: [AuthController],
  providers: [
    // Ports → adapters.
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: BACKUP_CODE_REPOSITORY, useClass: PrismaBackupCodeRepository },
    { provide: FAILED_LOGIN_COUNTER, useClass: RedisFailedLoginCounter },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    {
      provide: USER_OAUTH_IDENTITY_REPOSITORY,
      useClass: PrismaUserOAuthIdentityRepository,
    },
    MockOAuthProvider,
    oauthProvidersFactory,
    TotpService,
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
  ],
  exports: [SESSION_REPOSITORY, USER_REPOSITORY, TOKEN_SERVICE, RefreshSessionUseCase],
})
export class IdentityModule {}
