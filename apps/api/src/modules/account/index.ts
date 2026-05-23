/**
 * Public API of the Account module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { AccountModule } from './account.module';

// Ports — Symbol DI tokens + interfaces, the sanctioned cross-module
// surface. The barrel just makes the import path uniform.
export * from './application/ports/account-deleter';
export * from './application/ports/account-purger';
export * from './application/ports/admin-user-query';
export * from './application/ports/preferences.repository';
export * from './application/ports/trusted-contact.repository';
export * from './application/ports/user-data-aggregator';

// Public constant — admin's retention-stats use-case reads the
// same default-window value the soft-deleted-user purger uses,
// so the two stay in lock-step. Lives at the policy layer.
export { DEFAULT_RETENTION_DAYS } from './application/purge-soft-deleted-users.use-case';
