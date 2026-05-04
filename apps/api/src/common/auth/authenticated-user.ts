/**
 * Shape of `req.user` that the `JwtAuthGuard` attaches on every
 * authenticated request. Deliberately minimal — this is the stable
 * cross-module contract. Anything richer (name, email, flags) comes
 * from a use-case hydrating the User row, not from the token.
 *
 * Installed by prompt [III.11.3].
 */
export type Role = 'user' | 'premium' | 'agent' | 'admin' | 'compliance';

export interface AuthenticatedUser {
  readonly sub: string; // user id
  readonly sid: string; // session id
  readonly role: Role;
}

/** Fastify request augmentation so `req.user` typechecks downstream. */
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
