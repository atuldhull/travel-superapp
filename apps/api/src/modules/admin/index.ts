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
