/**
 * Public API of the Weather module. Cross-module consumers MUST
 * import only from this barrel — reaching into `./domain/`,
 * `./application/`, `./infrastructure/`, or `./interface/` is
 * forbidden by the `no-cross-module-deep-import` rule in
 * `.dependency-cruiser.cjs` (landing in [B2]).
 *
 * Authored by [B1] — module-boundaries hardening.
 */
export { WeatherModule } from './weather.module';

export * from './application/ports/weather-cache';
export * from './application/ports/weather-provider';

// Public composition surface — Trip orchestrates Weather into the
// trip overview composite + the near-me-now nearby query.
export { GetForecastUseCase } from './application/get-forecast.use-case';
export type { WeatherForecast } from './domain/weather-forecast.entity';
