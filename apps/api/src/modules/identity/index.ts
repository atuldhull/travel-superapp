/**
 * Public API of the Identity module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `IdentityModule` —
 * cross-module DI imports use `./identity.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

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
