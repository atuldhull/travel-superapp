/**
 * Public API of the Account module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `AccountModule` —
 * cross-module DI imports use `./account.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

// Ports — Symbol DI tokens + interfaces, the sanctioned cross-module
// surface. The barrel just makes the import path uniform.
export * from './application/ports/account-deleter';
export * from './application/ports/account-purger';
export * from './application/ports/admin-user-query';
export * from './application/ports/preferences.repository';
export * from './application/ports/trusted-contact.repository';
export * from './application/ports/user-data-aggregator';
