/**
 * Port for caching forecast responses. Intentionally narrow — we
 * need `get` + `set` keyed by an opaque string, nothing else.
 * Adapter shapes (Redis vs in-memory vs DB) vary behind it.
 *
 * The cache stores domain-shape `WeatherForecast` objects, not raw
 * provider responses — so future provider swaps don't invalidate
 * every cached entry just because the upstream JSON shape changed.
 *
 * Installed by prompt [IV.18.5.2].
 */
import type { HourlyWeatherForecast, WeatherForecast } from '../../domain/weather-forecast.entity';

export interface WeatherCache {
  /** Returns the cached forecast if still fresh, `null` on miss or
   *  if the cache backend is unreachable. */
  get(key: string): Promise<WeatherForecast | null>;

  /** Write with a per-entry TTL (seconds). Best-effort — failures
   *  to write MUST NOT propagate to the caller (the original
   *  forecast was already successfully fetched). */
  set(key: string, value: WeatherForecast, ttlSeconds: number): Promise<void>;

  /** V.UX.21 — hourly forecast read/write. Separate methods (not a
   *  generic typed map) so adapters can pick different TTLs / key
   *  prefixes per kind without leaking that into the use-case. */
  getHourly(key: string): Promise<HourlyWeatherForecast | null>;
  setHourly(key: string, value: HourlyWeatherForecast, ttlSeconds: number): Promise<void>;
}

export const WEATHER_CACHE = Symbol('WeatherCache');
