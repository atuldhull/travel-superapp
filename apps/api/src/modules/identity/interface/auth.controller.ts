/**
 * Auth HTTP surface: register, login, refresh, logout.
 *
 * Refresh cookie policy (CLAUDE rule 12 + Playbook §13.2):
 *   - `httpOnly: true`     — JS can't read it.
 *   - `sameSite: 'strict'` — CSRF defence.
 *   - `secure` in prod     — HTTPS-only in staging/prod; allowed over
 *                            http in dev/test for Fastify inject.
 *   - `path: '/api/v1/auth'` — cookie is only sent to auth routes;
 *                            keeps it out of other subsystems' access logs.
 *   - `maxAge` mirrors the refresh token's TTL.
 *
 * The access token is returned in the JSON body — clients keep it in
 * memory only (NEVER localStorage).
 *
 * Rate-limiting: the class-level `@Throttle({ auth: ... })` drops the
 * bucket to the stricter `auth` named limiter (5/min outside test
 * mode). /refresh also sits on auth — a stolen refresh cookie can
 * still be rate-limited at the endpoint.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '@app/config';
import { ConfigService } from '@nestjs/config';
import { type AuthenticatedUser, CurrentUser, Public } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { IssueSessionUseCase } from '../../identity/application/issue-session.use-case';
import { LoginUseCase } from '../../identity/application/login.use-case';
import {
  DisableMfaUseCase,
  RegenerateBackupCodesUseCase,
  SetupMfaUseCase,
  VerifyMfaUseCase,
} from '../../identity/application/mfa.use-case';
import { RefreshSessionUseCase } from '../../identity/application/refresh-session.use-case';
import { RegisterUseCase } from '../../identity/application/register.use-case';
import { RevokeSessionUseCase } from '../../identity/application/revoke-session.use-case';
import { SignInWithOAuthUseCase } from '../../identity/application/sign-in-with-oauth.use-case';
import {
  LoginBodySchema,
  MfaCodeBodySchema,
  OAuthSignInBodySchema,
  RegisterBodySchema,
  type LoginBody,
  type MfaCodeBody,
  type OAuthSignInBody,
  type RegisterBody,
} from './dto/auth.dto';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

interface AuthSuccessBody {
  readonly userId: string;
  readonly accessToken: string;
  readonly expiresAt: string;
}

/**
 * No class-level `@Throttle` decorator — the `auth` named bucket from
 * `RateLimitModule` (5/min in prod) still fires because @nestjs/throttler
 * v6 stacks all named buckets on routes without overrides. The route
 * therefore inherits `default` (60/min) AND `auth` (5/min), and the
 * smaller wins. Test mode inflates all buckets 10,000× so the suite
 * doesn't trip 429s on cumulative traffic.
 */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    private readonly registerUc: RegisterUseCase,
    private readonly loginUc: LoginUseCase,
    private readonly refreshUc: RefreshSessionUseCase,
    private readonly revokeUc: RevokeSessionUseCase,
    private readonly setupMfaUc: SetupMfaUseCase,
    private readonly verifyMfaUc: VerifyMfaUseCase,
    private readonly disableMfaUc: DisableMfaUseCase,
    private readonly regenBackupUc: RegenerateBackupCodesUseCase,
    private readonly oauthUc: SignInWithOAuthUseCase,
    // Kept for future direct session-issuance flows (magic-link)
    // even though not called directly in this file today.
    @Inject(IssueSessionUseCase) private readonly _issue: IssueSessionUseCase,
  ) {
    void this._issue;
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(RegisterBodySchema))
  async register(
    @Body() body: RegisterBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSuccessBody> {
    const issued = await this.registerUc.execute({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      deviceContext: this.deviceContext(req),
    });
    this.setRefreshCookie(reply, issued.refreshToken, issued.refreshTokenExpiresAt);
    return {
      userId: issued.userId,
      accessToken: issued.accessToken,
      expiresAt: issued.accessTokenExpiresAt.toISOString(),
    };
  }

  /**
   * OAuth sign-in. Verifies a provider-issued ID token and either
   * signs the user into an existing account, auto-links to their
   * password account by email, or creates a brand-new passwordless
   * account. Returns the same `AuthSuccessBody` shape register + login
   * do, so clients share token-handling logic across all entry points.
   *
   * Provider registry is populated at module init from env:
   *   - `mock` registered outside NODE_ENV=production (dev + tests).
   *   - `google` registered when `GOOGLE_CLIENT_ID` is set.
   * Unknown provider → 401 `OAUTH_PROVIDER_UNKNOWN`.
   *
   * Signature / audience / email-unverified failures from the adapter
   * surface as 401 `OAUTH_INVALID_TOKEN` / `OAUTH_EMAIL_UNVERIFIED`.
   */
  @Public()
  @Post('oauth/:provider')
  @HttpCode(HttpStatus.OK)
  async oauth(
    @Param('provider') provider: string,
    @Body(new ZodValidationPipe(OAuthSignInBodySchema)) body: OAuthSignInBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSuccessBody> {
    const issued = await this.oauthUc.execute({
      provider,
      idToken: body.idToken,
      deviceContext: this.deviceContext(req),
    });
    this.setRefreshCookie(reply, issued.refreshToken, issued.refreshTokenExpiresAt);
    return {
      userId: issued.userId,
      accessToken: issued.accessToken,
      expiresAt: issued.accessTokenExpiresAt.toISOString(),
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginBodySchema))
  async login(
    @Body() body: LoginBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSuccessBody> {
    const issued = await this.loginUc.execute({
      email: body.email,
      password: body.password,
      // `exactOptionalPropertyTypes` is on — only set the key when present.
      ...(body.mfaCode !== undefined ? { mfaCode: body.mfaCode } : {}),
      deviceContext: this.deviceContext(req),
    });
    this.setRefreshCookie(reply, issued.refreshToken, issued.refreshTokenExpiresAt);
    return {
      userId: issued.userId,
      accessToken: issued.accessToken,
      expiresAt: issued.accessTokenExpiresAt.toISOString(),
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Omit<AuthSuccessBody, 'userId'>> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      // Matches "invalid refresh" from the use-case. Handled by the
      // global domain filter → 401.
      const { UnauthorizedError } = await import('@app/errors');
      throw new UnauthorizedError('Missing refresh token', {}, 'REFRESH_MISSING');
    }
    const device = this.deviceContext(req);
    const refreshed = await this.refreshUc.execute({
      refreshToken,
      deviceFingerprint: device.deviceFingerprint,
      deviceId: device.deviceId,
      userAgent: device.userAgent,
      ipHash: device.ipHash,
    });
    this.setRefreshCookie(reply, refreshed.refreshToken, refreshed.refreshTokenExpiresAt);
    return {
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.accessTokenExpiresAt.toISOString(),
    };
  }

  /**
   * Protected probe endpoint. The `JwtAuthGuard` validates the access
   * token; `@CurrentUser()` returns the claims. First real consumer of
   * the guard stack — any feature module follows the same pattern.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  /**
   * Begin MFA enrollment. Returns the base32 secret + the
   * `otpauth://` provisioning URI for the client to render as a
   * QR code. The secret is persisted as a staging value; MFA is
   * not yet active until `/mfa/verify` confirms with a code.
   */
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  async mfaSetup(@CurrentUser() user: AuthenticatedUser): Promise<{
    base32: string;
    otpauthUri: string;
  }> {
    const result = await this.setupMfaUc.execute(user.sub);
    return { base32: result.base32, otpauthUri: result.otpauthUri };
  }

  /**
   * Confirm MFA enrollment by proving the user's authenticator
   * app works. On the first-time transition we also emit 10
   * single-use plaintext backup codes — shown ONCE, never
   * retrievable again. On re-verify of an already-enabled account
   * (idempotent no-op), `backupCodes` is null.
   */
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(MfaCodeBodySchema))
  async mfaVerify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MfaCodeBody,
  ): Promise<{ backupCodes: readonly string[] | null }> {
    const result = await this.verifyMfaUc.execute(user.sub, body.code);
    return { backupCodes: result.backupCodes };
  }

  /**
   * Regenerate the 10 single-use backup codes. Requires a valid
   * current TOTP so a hijacked session can't silently rotate codes
   * (which would lock the legitimate user out of the recovery
   * path). Returns the new plaintexts — shown once, never again.
   */
  @Post('mfa/backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(MfaCodeBodySchema))
  async regenerateBackupCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MfaCodeBody,
  ): Promise<{ backupCodes: readonly string[] }> {
    const codes = await this.regenBackupUc.execute(user.sub, body.code);
    return { backupCodes: codes };
  }

  /**
   * Turn MFA off. Requires a valid current code — a hijacked
   * session alone can't strip the second factor.
   */
  @Post('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(MfaCodeBodySchema))
  async mfaDisable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MfaCodeBody,
  ): Promise<void> {
    await this.disableMfaUc.execute(user.sub, body.code);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    await this.revokeUc.execute(refreshToken);
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  // ─── helpers ───────────────────────────────────────────────────────

  private deviceContext(req: FastifyRequest): {
    deviceId: string | null;
    userAgent: string | null;
    ipHash: string | null;
    deviceFingerprint: string;
  } {
    const pepper = this.config.get('RATE_LIMIT_PEPPER', { infer: true });
    const ua = (req.headers['user-agent'] ?? null) as string | null;
    const ip = req.ip ?? null;
    const ipHash = ip
      ? createHash('sha256')
          .update(pepper + ip, 'utf8')
          .digest('hex')
      : null;
    // Device fingerprint = sha256(pepper + userAgent). Deliberately
    // excludes IP — mobile clients roam between wifi and cellular,
    // and locking sessions to an IP would force re-auth on every
    // network change. UA catches the meaningful threat: a stolen
    // refresh token presented from a completely different client
    // (browser → curl, one app → another). A later prompt will
    // promote this to a client-supplied `X-Device-Id` header once
    // the mobile app plumbing lands.
    const deviceFingerprint = createHash('sha256')
      .update(`${pepper}|${ua ?? ''}`, 'utf8')
      .digest('hex');
    // NB: `Session.deviceId` is a FK to `Device` — we don't auto-create
    // a Device row in this slice. A later prompt will introduce
    // `RegisterDeviceUseCase` so the `x-device-id` header can be
    // persisted. For now the session is linked to the user only.
    return { deviceId: null, userAgent: ua, ipHash, deviceFingerprint };
  }

  private setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    const isProdLike = nodeEnv === 'production' || nodeEnv === 'staging';
    const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    reply.setCookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProdLike,
      path: REFRESH_COOKIE_PATH,
      maxAge: maxAgeSeconds,
    });
  }
}
