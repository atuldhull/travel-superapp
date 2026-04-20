/**
 * `@CurrentUser()` param decorator — extracts the `AuthenticatedUser`
 * the `JwtAuthGuard` attached to `req.user`. On a public or
 * unauthenticated route it throws; that's a bug at the call site
 * (you asked for the user but didn't require authentication).
 *
 * Usage:
 *   @Get('me')
 *   me(@CurrentUser() user: AuthenticatedUser) { return user; }
 *
 * Installed by prompt [III.11.3].
 */
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from './authenticated-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!req.user) {
      throw new Error(
        '@CurrentUser() used on a route without an authenticated user — ' +
          'either apply JwtAuthGuard or remove @Public().',
      );
    }
    return req.user;
  },
);
