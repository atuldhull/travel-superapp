/**
 * Public API of the Transport module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `TransportModule` —
 * cross-module DI imports use `./transport.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/navigation-provider';
export * from './application/ports/routing-cache';
export * from './application/ports/routing-provider';
export * from './application/ports/traffic-provider';

// Public composition surface — Trip orchestrates Transport for
// per-day routing legs + near-me-now route shaping.
export { GetRoutesUseCase } from './application/get-routes.use-case';
export type { RouteLeg } from './domain/route-leg.entity';
