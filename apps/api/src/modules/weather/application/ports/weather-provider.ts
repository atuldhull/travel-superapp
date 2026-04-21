/**
 * Port for a weather data provider. `[IV.18.5.1]` ships one adapter
 * (`OpenMeteoWeatherProvider`); a future `[IV.18.5.x]` swaps in a
 * paid provider (OWM, Tomorrow.io) by adding a sibling adapter class
 * and flipping the module wiring.
 *
 * Intentionally narrow — the domain only needs a daily forecast
 * today. Hourly / alerts / air-quality land as separate port methods
 * when a caller actually wants them.
 *
 * Installed by prompt [IV.18.5.1].
 */
import type { WeatherForecast } from '../../domain/weather-forecast.entity';

export interface GetDailyForecastInput {
  readonly lat: number;
  readonly lng: number;
  /** Clamp: 1 ≤ days ≤ 16 (Open-Meteo's hard cap). Use-case enforces. */
  readonly days: number;
}

export interface WeatherProvider {
  getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast>;
}

export const WEATHER_PROVIDER = Symbol('WeatherProvider');
