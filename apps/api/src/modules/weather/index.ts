/**
 * Public API of the Weather module. Cross-module CODE consumers
 * (ports, types, public use-cases) MUST import from this barrel —
 * reaching into `./domain/`, `./application/`, `./infrastructure/`,
 * or `./interface/` is forbidden by the `no-cross-module-deep-import`
 * rule in `.dependency-cruiser.cjs`.
 *
 * The ONE exception is the NestJS module class `WeatherModule` —
 * cross-module DI imports use `./weather.module` directly, not this
 * barrel ([C4]: re-exporting the module class here triggered a CJS
 * partial-module cycle that bricked AppModule bootstrap).
 *
 * Authored by [B1]; module-class re-export removed by [C4].
 */

export * from './application/ports/weather-cache';
export * from './application/ports/weather-provider';

// Public composition surface — Trip orchestrates Weather into the
// trip overview composite + the near-me-now nearby query.
export { GetForecastUseCase } from './application/get-forecast.use-case';
export type { WeatherForecast } from './domain/weather-forecast.entity';
