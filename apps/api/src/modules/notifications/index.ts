/**
 * Public API of the Notifications module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `NotificationsModule` —
 * cross-module DI imports use `./notifications.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/notification-log.repository';
export * from './application/ports/notification-preference.repository';
export * from './application/ports/notification-sender';
export * from './application/ports/push-subscription.repository';
