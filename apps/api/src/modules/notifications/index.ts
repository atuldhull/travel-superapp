/**
 * Public API of the Notifications module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { NotificationsModule } from './notifications.module';

export * from './application/ports/notification-log.repository';
export * from './application/ports/notification-preference.repository';
export * from './application/ports/notification-sender';
export * from './application/ports/push-subscription.repository';
