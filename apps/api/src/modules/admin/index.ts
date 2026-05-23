/**
 * Public API of the Admin module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `AdminModule` —
 * cross-module DI imports use `./admin.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/admin-audit-log.repository';
export * from './application/ports/compliance-queries.port';

// Public admin-audit helper — sibling modules call this from each
// admin-* use-case to write the audit-log row. It's shaped as a
// shared utility today; lifting it to an AdminAuditPort (proper
// DI seam) is a future architectural cleanup, separate from B4's
// "make every cross-module dependency go through the barrel" goal.
export { recordAdminAction } from './application/record-admin-action.helper';
