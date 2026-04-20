/**
 * Global HTTP guard that requires a valid access JWT on every route
 * not marked `@Public()`.
 *
 * Token extraction: `Authorization: Bearer <token>`. Anything else is
 * treated as missing — cookies are NOT read here (the refresh cookie
 * is only consumed by /auth/refresh via a public route).
 *
 * Verification goes through the `TOKEN_SERVICE` port exported by
 * `IdentityModule`, not directly to `@app/auth`, so the guard stays
 * DI-friendly and swappable for tests.
 *
 * On success, sets `req.user = { sub, sid, role }`. On failure,
 * throws `UnauthorizedError` → the global domain filter renders a
 * 401 JSON with `code: 'UNAUTHENTICATED'` (or a more specific code
 * from `@app/auth`'s `JwtVerificationError` if available).
 *
 * Installed by prompt [III.11.3].
 */
import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { JwtVerificationError } from '@app/auth';
import { UnauthorizedError } from '@app/errors';
import type { AuthenticatedUser, Role } from './authenticated-user';
import { IS_PUBLIC_KEY } from './public.decorator';
import {
  TOKEN_SERVICE,
  type TokenService,
} from '../../modules/identity/application/ports/token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Public routes bypass auth entirely. Handler-level decorator wins
    // over class-level — getAllAndOverride walks [handler, class].
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const token = extractBearer(req);
    if (!token) {
      throw new UnauthorizedError('Missing bearer token', {}, 'UNAUTHENTICATED');
    }

    try {
      const claims = await this.tokens.verifyAccessToken(token);
      req.user = {
        sub: claims.sub,
        sid: claims.sid,
        role: claims.role as Role,
      } satisfies AuthenticatedUser;
      return true;
    } catch (err) {
      if (err instanceof JwtVerificationError) {
        throw new UnauthorizedError(
          'Invalid access token',
          { reason: err.code },
          'UNAUTHENTICATED',
        );
      }
      throw err;
    }
  }
}

function extractBearer(req: FastifyRequest): string | null {
  const raw = req.headers['authorization'];
  if (typeof raw !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1]!.trim() : null;
}
