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
import type { HourlyWeatherForecast, WeatherForecast } from '../../domain/weather-forecast.entity';

export interface GetDailyForecastInput {
  readonly lat: number;
  readonly lng: number;
  /** Clamp: 1 ≤ days ≤ 16 (Open-Meteo's hard cap). Use-case enforces. */
  readonly days: number;
}

/**
 * V.UX.21 — hourly forecast input for the adventure / outdoor persona.
 * `hours` clamped to [1, 48] at the use-case (Open-Meteo gives 16 days
 * of hourly data, but the adventure-window UX cares about the next 24-48h).
 */
export interface GetHourlyForecastInput {
  readonly lat: number;
  readonly lng: number;
  readonly hours: number;
}

export interface WeatherProvider {
  getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast>;
  getHourlyForecast(input: GetHourlyForecastInput): Promise<HourlyWeatherForecast>;
}

export const WEATHER_PROVIDER = Symbol('WeatherProvider');
