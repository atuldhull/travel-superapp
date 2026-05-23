/**
 * Public API of the Transport module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { TransportModule } from './transport.module';

export * from './application/ports/navigation-provider';
export * from './application/ports/routing-cache';
export * from './application/ports/routing-provider';
export * from './application/ports/traffic-provider';
