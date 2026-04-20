/**
 * `@Public()` marks a route (or entire controller) as not requiring
 * authentication. The global `JwtAuthGuard` skips any handler whose
 * target or class has this metadata.
 *
 * Usage:
 *   @Public()
 *   @Get()
 *   list() {}
 *
 *   @Public()
 *   @Controller('auth')
 *   export class AuthController {}
 *
 * Installed by prompt [III.11.3].
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);
