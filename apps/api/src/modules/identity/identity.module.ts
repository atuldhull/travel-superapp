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
import { Module } from '@nestjs/common';
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
import { SESSION_REPOSITORY } from './application/ports/session.repository';
import { TOKEN_SERVICE } from './application/ports/token.service';
import { USER_REPOSITORY } from './application/ports/user.repository';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { RegisterUseCase } from './application/register.use-case';
import { RevokeSessionUseCase } from './application/revoke-session.use-case';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import { PrismaBackupCodeRepository } from './infrastructure/prisma-backup-code.repository';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { RedisFailedLoginCounter } from './infrastructure/redis-failed-login-counter';
import { TotpService } from './infrastructure/totp.service';
import { AuthController } from './interface/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    // Ports → adapters.
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: BACKUP_CODE_REPOSITORY, useClass: PrismaBackupCodeRepository },
    { provide: FAILED_LOGIN_COUNTER, useClass: RedisFailedLoginCounter },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
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
  ],
  exports: [SESSION_REPOSITORY, USER_REPOSITORY, TOKEN_SERVICE, RefreshSessionUseCase],
})
export class IdentityModule {}
