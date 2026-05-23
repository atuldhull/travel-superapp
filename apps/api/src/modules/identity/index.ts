/**
 * Public API of the Identity module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { IdentityModule } from './identity.module';

export * from './application/ports/backup-code.repository';
export * from './application/ports/failed-login-counter';
export * from './application/ports/jwt-keyring.store';
export * from './application/ports/login-code.repository';
export * from './application/ports/magic-link-token.repository';
export * from './application/ports/oauth-provider';
export * from './application/ports/password-reset-token.repository';
export * from './application/ports/session.repository';
export * from './application/ports/sms-sender.port';
export * from './application/ports/token.service';
export * from './application/ports/totp.port';
export * from './application/ports/user-oauth-identity.repository';
export * from './application/ports/user.repository';

// Public event payload types — notifications handlers read
// SessionIssuedPayload off the bus to drive welcome / new-device
// alerts. `makeSessionEvent` stays private to identity.
export type { SessionIssuedEvent, SessionIssuedPayload } from './domain/session.events';
