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
import { RefreshSessionUseCase } from '../../identity/application/refresh-session.use-case';
import { RegisterUseCase } from '../../identity/application/register.use-case';
import { RevokeSessionUseCase } from '../../identity/application/revoke-session.use-case';
import {
  LoginBodySchema,
  RegisterBodySchema,
  type LoginBody,
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
    // Kept for future direct session-issuance flows (OAuth callback,
    // magic-link) even though not called directly in this file today.
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
    // Minimal fingerprint: sha256(pepper + ua + ip). A real mobile
    // client will send a dedicated header (`X-Device-Id`) later.
    const deviceFingerprint = createHash('sha256')
      .update(`${pepper}|${ua ?? ''}|${ip ?? ''}`, 'utf8')
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
