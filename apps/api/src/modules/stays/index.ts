/**
 * Public API of the Stays module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { StaysModule } from './stays.module';

export * from './application/ports/stay-cache';
export * from './application/ports/stay-provider';
