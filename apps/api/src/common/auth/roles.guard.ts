/**
 * Checks `@Roles(...)` metadata against `req.user.role` that the
 * `JwtAuthGuard` attached earlier in the chain.
 *
 * Policy:
 *   - No `@Roles` metadata → pass (role check opt-in).
 *   - `@Public()` → `JwtAuthGuard` already short-circuited; `req.user`
 *     is absent. Pass through (public routes are role-free by
 *     definition).
 *   - `@Roles(...)` present + role matches → pass.
 *   - `@Roles(...)` present + role mismatch → `ForbiddenError` → 403.
 *
 * Installed by prompt [III.11.3].
 */
import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ForbiddenError } from '@app/errors';
import { ROLES_KEY } from './roles.decorator';
import type { Role } from './authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = req.user;
    if (!user) {
      // A `@Roles(...)` route without authentication is a config bug.
      // Be loud rather than silently forbid.
      throw new Error(
        '@Roles() requires an authenticated user — ensure JwtAuthGuard runs before RolesGuard.',
      );
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenError(
        `Requires role in [${required.join(', ')}]`,
        { actual: user.role, required },
        'ROLE_FORBIDDEN',
      );
    }
    return true;
  }
}
