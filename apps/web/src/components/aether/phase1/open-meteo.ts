/**
 * AE395 — pure helpers for Open-Meteo weather lookup.
 *
 * Open-Meteo (open-meteo.com) is a free, no-key forecast + historical
 * API. Phase 1 uses it to replace AE388's simulated `WeatherState` with
 * the actual conditions at the trip's destination on the trip's start
 * date. AE388's simulation stays as the fallback for destinations we
 * don't have coords for + for fetch failures.
 *
 * No React, no fetch here. Builders + parsers only. The hook in
 * `use-real-weather.tsx` wires the network side.
 */
import type { DestinationCoords } from './destination-coords';
import type { WeatherState } from './weather-simulation';

/** Pick the daily-summary endpoint when we just need "what was it like
 *  on this day". Historical archive (`/v1/archive`) goes back to 1940;
 *  forecast (`/v1/forecast`) covers ~16 days ahead. Our caller picks
 *  the right one based on whether the trip date is in the past. */
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';

/** Render an ISO-date (YYYY-MM-DD) from a Date / ISO string. Returns
 *  null when the input isn't a valid date so the caller skips the URL. */
export function isoDateOnly(input: Date | string | null | undefined): string | null {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Build the Open-Meteo URL for a coords + date pair.
 *  - For past dates (> 5 days ago) we hit the archive endpoint
 *  - For today / near-past / near-future we hit the forecast endpoint
 *  Returns null if the date is unparseable. */
export function openMeteoUrl(
  coords: DestinationCoords,
  date: Date | string,
  now: Date = new Date(),
): string | null {
  const target = isoDateOnly(date);
  if (target === null) return null;
  const targetMs = new Date(`${target}T12:00:00Z`).getTime();
  const nowMs = now.getTime();
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const isPast = nowMs - targetMs > FIVE_DAYS;
  const base = isPast ? ARCHIVE_BASE : FORECAST_BASE;
  const params = new URLSearchParams({
    latitude: coords.lat.toFixed(4),
    longitude: coords.lng.toFixed(4),
    start_date: target,
    end_date: target,
    daily: 'weather_code,precipitation_sum,wind_speed_10m_max',
    timezone: 'auto',
  });
  return `${base}?${params.toString()}`;
}

/** Map Open-Meteo's WMO weather code to our 3-state Phase 1 enum.
 *
 *  Reference: https://open-meteo.com/en/docs (weather_code section).
 *  Codes 0..3 are clear/partly cloudy; 45..48 fog; 51..67 rain/drizzle/
 *  freezing rain; 71..77 snow; 80..82 rain showers; 85..86 snow showers;
 *  95..99 thunderstorm.
 *
 *  Phase 1's WeatherState union is 'clear' | 'rain' | 'storm'. We
 *  collapse: storm covers thunderstorm + heavy rain showers; rain
 *  covers normal rain / drizzle / snow showers (visual streaks read
 *  the same); everything else is clear. */
export function weatherCodeToState(code: number | null | undefined): WeatherState {
  if (code === null || code === undefined || !Number.isFinite(code)) return 'clear';
  const c = Math.floor(code);
  // Thunderstorm cluster
  if (c >= 95 && c <= 99) return 'storm';
  // Heavy rain showers
  if (c === 82) return 'storm';
  // Rain / drizzle / freezing rain / rain showers
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 81)) return 'rain';
  // Snow + snow showers
  if ((c >= 71 && c <= 77) || (c >= 85 && c <= 86)) return 'rain';
  return 'clear';
}

/** Parse Open-Meteo's daily response shape into a WeatherState.
 *
 *  Shape we read:
 *    { daily: { weather_code: number[] } }
 *
 *  Returns 'clear' when the response is malformed so the renderer
 *  never crashes on a partial / broken payload. */
export function parseOpenMeteoDaily(payload: unknown): WeatherState {
  if (payload === null || typeof payload !== 'object') return 'clear';
  const daily = (payload as { daily?: { weather_code?: unknown } }).daily;
  if (daily === undefined || daily === null) return 'clear';
  const arr = (daily as { weather_code?: unknown }).weather_code;
  if (!Array.isArray(arr) || arr.length === 0) return 'clear';
  const first = arr[0];
  if (typeof first !== 'number') return 'clear';
  return weatherCodeToState(first);
}
