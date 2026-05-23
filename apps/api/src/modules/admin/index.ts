/**
 * Public API of the Admin module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { AdminModule } from './admin.module';

export * from './application/ports/admin-audit-log.repository';
export * from './application/ports/compliance-queries.port';

// Public admin-audit helper — sibling modules call this from each
// admin-* use-case to write the audit-log row. It's shaped as a
// shared utility today; lifting it to an AdminAuditPort (proper
// DI seam) is a future architectural cleanup, separate from B4's
// "make every cross-module dependency go through the barrel" goal.
export { recordAdminAction } from './application/record-admin-action.helper';
