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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '@app/config';
import { ConfigService } from '@nestjs/config';
import { CLOCK, type Clock } from '@app/clock';
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
import { ConsumeMagicLinkUseCase } from '../../identity/application/consume-magic-link.use-case';
import { RequestLoginCodeUseCase } from '../../identity/application/request-login-code.use-case';
import { ConsumeLoginCodeUseCase } from '../../identity/application/consume-login-code.use-case';
import { MarkOnboardingCompleteUseCase } from '../../identity/application/mark-onboarding-complete.use-case';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../identity/application/ports/user.repository';
import { ConsumePasswordResetUseCase } from '../../identity/application/consume-password-reset.use-case';
import { RequestMagicLinkUseCase } from '../../identity/application/request-magic-link.use-case';
import { RequestPasswordResetUseCase } from '../../identity/application/request-password-reset.use-case';
import { SeedSampleTripUseCase } from '../../trip';
import { SignInWithOAuthUseCase } from '../../identity/application/sign-in-with-oauth.use-case';
import {
  LoginBodySchema,
  MagicLinkConsumeBodySchema,
  MagicLinkRequestBodySchema,
  LoginCodeRequestBodySchema,
  LoginCodeVerifyBodySchema,
  MfaCodeBodySchema,
  OAuthSignInBodySchema,
  OnboardingCompleteBodySchema,
  PasswordResetConsumeBodySchema,
  PasswordResetRequestBodySchema,
  RegisterBodySchema,
  type LoginBody,
  type MagicLinkConsumeBody,
  type MagicLinkRequestBody,
  type LoginCodeRequestBody,
  type LoginCodeVerifyBody,
  type MfaCodeBody,
  type OAuthSignInBody,
  type OnboardingCompleteBody,
  type PasswordResetConsumeBody,
  type PasswordResetRequestBody,
  type RegisterBody,
} from './dto/auth.dto';
import {
  AuthSuccessResponseDto,
  MagicLinkRequestResponseDto,
  OnboardingCompleteResponseDto,
  PasswordResetConsumeResponseDto,
  PasswordResetRequestResponseDto,
  RefreshSuccessResponseDto,
  WhoAmIResponseDto,
} from './dto/auth-response.dto';
import {
  LoginRequestDto,
  MagicLinkConsumeRequestDto,
  MagicLinkRequestRequestDto,
  LoginCodeRequestRequestDto,
  LoginCodeVerifyRequestDto,
  OAuthSignInRequestDto,
  OnboardingCompleteRequestDto,
  PasswordResetConsumeRequestDto,
  PasswordResetRequestRequestDto,
  RegisterRequestDto,
} from './dto/auth-request.dto';

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
@ApiTags('identity')
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
    private readonly magicLinkRequestUc: RequestMagicLinkUseCase,
    private readonly magicLinkConsumeUc: ConsumeMagicLinkUseCase,
    private readonly loginCodeRequestUc: RequestLoginCodeUseCase,
    private readonly loginCodeVerifyUc: ConsumeLoginCodeUseCase,
    private readonly passwordResetRequestUc: RequestPasswordResetUseCase,
    private readonly passwordResetConsumeUc: ConsumePasswordResetUseCase,
    private readonly markOnboardingCompleteUc: MarkOnboardingCompleteUseCase,
    private readonly seedSampleTripUc: SeedSampleTripUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    // Kept for future direct session-issuance flows even though not
    // called directly in this file today (magic-link uses ConsumeMagicLinkUseCase
    // which already wraps IssueSessionUseCase).
    @Inject(IssueSessionUseCase) private readonly _issue: IssueSessionUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    void this._issue;
  }

  @ApiOperation({
    summary:
      'Create a new account. Email + password + displayName. Sets the refresh-cookie + returns access token.',
  })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Account created; refresh-cookie set; access token returned.',
    type: AuthSuccessResponseDto,
  })
  @ApiResponse({ status: 409, description: 'EMAIL_TAKEN.' })
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
  @ApiOperation({
    summary:
      'OAuth sign-in. Verifies a provider id token (Google / Apple / mock); auto-links by email or creates a passwordless account.',
  })
  @ApiBody({ type: OAuthSignInRequestDto })
  @ApiResponse({
    status: 200,
    description: 'OAuth sign-in succeeded; refresh-cookie set; access token returned.',
    type: AuthSuccessResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'OAUTH_PROVIDER_UNKNOWN / OAUTH_INVALID_TOKEN / OAUTH_EMAIL_UNVERIFIED.',
  })
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

  /**
   * Passwordless sign-in — step 1. Email-only. Always returns 200
   * regardless of whether the email is registered (privacy +
   * enumeration defence). The use-case soft-rate-limits per email
   * (max 5 mints per 15 minutes) and silently no-ops over-quota.
   *
   * Real users get a deliverable email; non-users get nothing.
   *
   * Installed by prompt [V.UX.2].
   */
  @ApiOperation({
    summary:
      "Passwordless sign-in step 1: email a magic link. Always returns 'ok' — doesn't reveal whether the email is registered.",
  })
  @ApiBody({ type: MagicLinkRequestRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Always ok. Email may or may not have been sent.',
    type: MagicLinkRequestResponseDto,
  })
  @Public()
  @Post('magic-link/request')
  @HttpCode(HttpStatus.OK)
  async magicLinkRequest(
    @Body(new ZodValidationPipe(MagicLinkRequestBodySchema)) body: MagicLinkRequestBody,
  ): Promise<{ status: 'ok' }> {
    await this.magicLinkRequestUc.execute({ email: body.email });
    return { status: 'ok' };
  }

  /**
   * Passwordless sign-in — step 2. Consumes the email link's token.
   * Single-use, 15-minute TTL, race-safe via DB-level updateMany +
   * count. Issues a session identical to /login and /register: the
   * refresh cookie is set + the access token is returned in the JSON
   * body.
   *
   * Failures collapse to 401 `MAGIC_LINK_INVALID` (no info leak on
   * whether the token was wrong vs. expired vs. already consumed).
   *
   * Installed by prompt [V.UX.2].
   */
  @ApiOperation({
    summary:
      'Passwordless sign-in step 2: consume the magic-link token + issue a session. Single-use, 15-min TTL.',
  })
  @ApiBody({ type: MagicLinkConsumeRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Sign-in succeeded; refresh-cookie set; access token returned.',
    type: AuthSuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'MAGIC_LINK_INVALID.' })
  @Public()
  @Post('magic-link/consume')
  @HttpCode(HttpStatus.OK)
  async magicLinkConsume(
    @Body(new ZodValidationPipe(MagicLinkConsumeBodySchema)) body: MagicLinkConsumeBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSuccessBody> {
    const issued = await this.magicLinkConsumeUc.execute({
      token: body.token,
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
   * Phase 1 (B1/B2) — passwordless OTP step 1. Email or SMS a 6-digit
   * code. Always returns 'ok' (enumeration-safe); soft-rate-limited
   * (≤5 per destination / 15 min) inside the use-case.
   */
  @ApiOperation({
    summary:
      "Passwordless OTP step 1: email/SMS a 6-digit code. Always 'ok' — never reveals registration.",
  })
  @ApiBody({ type: LoginCodeRequestRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Always ok. Code may or may not have been sent.',
    type: MagicLinkRequestResponseDto,
  })
  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async otpRequest(
    @Body(new ZodValidationPipe(LoginCodeRequestBodySchema)) body: LoginCodeRequestBody,
  ): Promise<{ status: 'ok' }> {
    await this.loginCodeRequestUc.execute({
      channel: body.channel,
      destination: body.destination,
    });
    return { status: 'ok' };
  }

  /**
   * Phase 1 (B1/B2) — passwordless OTP step 2. Verify the code +
   * issue a session (refresh-cookie set, access token returned).
   * Wrong / expired / consumed / too-many-attempts → 401
   * LOGIN_CODE_INVALID (no info leak). Works for new + existing users.
   */
  @ApiOperation({
    summary: 'Passwordless OTP step 2: verify the code + issue a session.',
  })
  @ApiBody({ type: LoginCodeVerifyRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Sign-in succeeded; refresh-cookie set; access token returned.',
    type: AuthSuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'LOGIN_CODE_INVALID.' })
  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async otpVerify(
    @Body(new ZodValidationPipe(LoginCodeVerifyBodySchema)) body: LoginCodeVerifyBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSuccessBody> {
    const issued = await this.loginCodeVerifyUc.execute({
      channel: body.channel,
      destination: body.destination,
      code: body.code,
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
   * V.UX.31 — request a password-reset email. Always returns success
   * regardless of whether the email is registered (enumeration-safe).
   * Soft-rate-limited at 5 tokens per email per 15-minute window
   * inside the use-case; the named `auth` throttle bucket also caps
   * total request volume.
   *
   * Installed by prompt [V.UX.31].
   */
  @ApiOperation({
    summary:
      'V.UX.31 — request a password-reset email. Always returns ok regardless of registration state.',
  })
  @ApiBody({ type: PasswordResetRequestRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Always ok. Email may or may not have been sent.',
    type: PasswordResetRequestResponseDto,
  })
  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async passwordResetRequest(
    @Body(new ZodValidationPipe(PasswordResetRequestBodySchema)) body: PasswordResetRequestBody,
  ): Promise<{ status: 'ok' }> {
    await this.passwordResetRequestUc.execute({ email: body.email });
    return { status: 'ok' };
  }

  /**
   * V.UX.31 — consume the reset token and set a new password. The
   * caller is NOT signed in afterward — they must explicitly /login
   * with the new password (so a "borrowed device" reset doesn't
   * leave a session in the borrowed browser).
   *
   * Installed by prompt [V.UX.31].
   */
  @ApiOperation({
    summary:
      'V.UX.31 — consume the password-reset token + set a new password. Single-use, 15-min TTL.',
  })
  @ApiBody({ type: PasswordResetConsumeRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Password updated. User must sign in with the new password.',
    type: PasswordResetConsumeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'RESET_TOKEN_INVALID.' })
  @ApiResponse({ status: 422, description: 'WEAK_PASSWORD or VALIDATION_FAILED.' })
  @Public()
  @Post('password-reset/consume')
  @HttpCode(HttpStatus.OK)
  async passwordResetConsume(
    @Body(new ZodValidationPipe(PasswordResetConsumeBodySchema)) body: PasswordResetConsumeBody,
  ): Promise<{ status: 'ok' }> {
    await this.passwordResetConsumeUc.execute({
      token: body.token,
      newPassword: body.newPassword,
    });
    return { status: 'ok' };
  }

  @ApiOperation({
    summary: 'Email + password login. With MFA enabled, mfaCode is required on the second call.',
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Login succeeded; refresh-cookie set; access token returned.',
    type: AuthSuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS / MFA_REQUIRED / MFA_INVALID.' })
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

  @ApiOperation({
    summary:
      'Rotate the access + refresh tokens. Reads the httpOnly refresh cookie; rejects if missing or stolen-detected.',
  })
  @ApiResponse({
    status: 200,
    description: 'New access token issued; new refresh cookie set.',
    type: RefreshSuccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'REFRESH_MISSING / REFRESH_INVALID / REFRESH_REUSED.' })
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
   * token; `@CurrentUser()` returns the claims. Hydrates a small slice
   * of User-row state the web client needs for routing decisions
   * (currently `hasSeenOnboarding`; more fields land in follow-ups).
   * Single indexed lookup per call — cost is negligible and saves an
   * extra round-trip on every page load.
   */
  @ApiOperation({
    summary:
      "Whoami probe — returns the authed user's JWT claims + lightweight User-row state (hasSeenOnboarding).",
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Caller JWT claims (sub / sid / role) + hasSeenOnboarding.',
    type: WhoAmIResponseDto,
  })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED — missing or invalid bearer.' })
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<{
    sub: string;
    sid: string;
    role: 'user' | 'premium' | 'agent' | 'admin' | 'compliance' | 'sre';
    hasSeenOnboarding: boolean;
    previousSeenAt: string | null;
  }> {
    // Soft-deleted users would already have been rejected by the
    // JwtAuthGuard's session lookup, so a missing row here is a
    // genuine race (e.g. user was just hard-deleted between guard
    // check and this DB read). Fall back to `hasSeenOnboarding=true`
    // so the web client doesn't loop them through /onboarding before
    // their session naturally invalidates.
    const row = await this.users.findById(user.sub);
    // V.UX.30 — atomically swap lastSeenAt → previousSeenAt and pull
    // the post-swap value so the welcome-back hero can render in the
    // same round-trip. On error fall back to the row value so the
    // probe never bounces.
    let previousSeenAt: Date | null = row?.previousSeenAt ?? null;
    try {
      const stamp = await this.users.stampSeen(user.sub, this.clock.now());
      previousSeenAt = stamp.previousSeenAt;
    } catch {
      /* best-effort */
    }
    return {
      sub: user.sub,
      sid: user.sid,
      role: user.role,
      hasSeenOnboarding: row?.hasSeenOnboarding ?? true,
      previousSeenAt: previousSeenAt ? previousSeenAt.toISOString() : null,
    };
  }

  /**
   * Mark the caller's `User.hasSeenOnboarding` flag as true. The web
   * client calls this from /onboarding's terminal steps; a subsequent
   * /auth/me sees the new value and stops bouncing to /onboarding.
   *
   * Optional body field `seedSample`: when true, ALSO seeds a single
   * read-only "Sample trip — Goa weekend" if the user has zero trips.
   * The web Skip terminal sends `seedSample: true`; the Generate
   * terminal omits it (the user already has a real trip).
   *
   * Idempotent on both axes — re-calling never re-seeds and never
   * re-flips.
   *
   * Installed by prompt [V.UX.3].
   */
  @ApiOperation({
    summary:
      'Mark the caller as having completed the onboarding wizard; optionally seed a Sample trip. Idempotent.',
  })
  @ApiBearerAuth()
  @ApiBody({ type: OnboardingCompleteRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Onboarding flag flipped (and Sample trip seeded if requested + applicable).',
    type: OnboardingCompleteResponseDto,
  })
  @ApiResponse({ status: 401, description: 'UNAUTHENTICATED.' })
  @Post('onboarding/complete')
  @HttpCode(HttpStatus.OK)
  async onboardingComplete(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(OnboardingCompleteBodySchema)) body: OnboardingCompleteBody,
  ): Promise<{ status: 'ok' }> {
    if (body.seedSample === true) {
      await this.seedSampleTripUc.execute(user.sub);
    }
    await this.markOnboardingCompleteUc.execute(user.sub);
    return { status: 'ok' };
  }

  /**
   * Begin MFA enrollment. Returns the base32 secret + the
   * `otpauth://` provisioning URI for the client to render as a
   * QR code. The secret is persisted as a staging value; MFA is
   * not yet active until `/mfa/verify` confirms with a code.
   */
  @ApiOperation({
    summary:
      'Begin MFA enrollment — returns base32 secret + otpauth:// URI for QR rendering. Pending until /mfa/verify confirms.',
  })
  @ApiBearerAuth()
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
  @ApiOperation({
    summary:
      'Confirm MFA enrollment with a TOTP code. First-time enable returns 10 plaintext backup codes (shown ONCE).',
  })
  @ApiBearerAuth()
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
  @ApiOperation({
    summary:
      'Regenerate the 10 single-use MFA backup codes. Requires a valid current TOTP. Returns plaintexts shown ONCE.',
  })
  @ApiBearerAuth()
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
  @ApiOperation({
    summary:
      'Disable MFA. Requires a valid TOTP — a hijacked session alone cannot strip the second factor.',
  })
  @ApiBearerAuth()
  @Post('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(MfaCodeBodySchema))
  async mfaDisable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: MfaCodeBody,
  ): Promise<void> {
    await this.disableMfaUc.execute(user.sub, body.code);
  }

  @ApiOperation({
    summary:
      'Logout — revokes the refresh token + clears the cookie. Idempotent if already logged out.',
  })
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
    const maxAgeSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - this.clock.nowMs()) / 1000),
    );
    reply.setCookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProdLike,
      path: REFRESH_COOKIE_PATH,
      maxAge: maxAgeSeconds,
    });
  }
}
