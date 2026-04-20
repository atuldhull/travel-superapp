/**
 * Public exports of `common/auth`. Everything downstream modules need
 * to consume the auth layer — guards, decorators, and the
 * `AuthenticatedUser` type.
 *
 * Installed by prompt [III.11.3].
 */
export { JwtAuthGuard } from './jwt-auth.guard';
export { RolesGuard } from './roles.guard';
export { Public, IS_PUBLIC_KEY } from './public.decorator';
export { Roles, ROLES_KEY } from './roles.decorator';
export { CurrentUser } from './current-user.decorator';
export type { AuthenticatedUser, Role } from './authenticated-user';
