/**
 * `@Roles('admin', 'premium')` restricts a route to authenticated
 * users whose `role` claim is in the list. Paired with `RolesGuard`.
 * If the decorator is absent, role check is skipped (but the
 * `JwtAuthGuard` still runs unless `@Public()` is present).
 *
 * Installed by prompt [III.11.3].
 */
import { SetMetadata } from '@nestjs/common';
import type { Role } from './authenticated-user';

export const ROLES_KEY = 'auth:roles';

export const Roles = (...roles: readonly Role[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
