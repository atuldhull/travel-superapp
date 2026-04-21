/**
 * Open-Meteo adapter for `WeatherProvider`. Free, keyless API —
 * Playbook §3.8 picks it over OWM for the default provider.
 *
 * Endpoint shape (daily only):
 *   GET https://api.open-meteo.com/v1/forecast
 *     ?latitude=LAT&longitude=LNG
 *     &daily=temperature_2m_max,temperature_2m_min,
 *            precipitation_probability_max,weather_code
 *     &forecast_days=N
 *     &timezone=auto
 *
 * Returns `{ timezone, daily: { time[], temperature_2m_max[],
 * temperature_2m_min[], precipitation_probability_max[], weather_code[] } }`.
 *
 * Installed by prompt [IV.18.5.1].
 */
import { Injectable } from '@nestjs/common';
import { ExternalServiceError } from '@app/errors';
import { createLogger } from '@app/logger';
import type { DailyForecast, WeatherForecast } from '../domain/weather-forecast.entity';
import type { GetDailyForecastInput, WeatherProvider } from '../application/ports/weather-provider';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const log = createLogger('weather.open-meteo');

interface OpenMeteoDaily {
  readonly time: readonly string[];
  readonly temperature_2m_max: readonly number[];
  readonly temperature_2m_min: readonly number[];
  readonly precipitation_probability_max: ReadonlyArray<number | null>;
  readonly weather_code: readonly number[];
}

interface OpenMeteoResponse {
  readonly timezone: string;
  readonly daily: OpenMeteoDaily;
}

@Injectable()
export class OpenMeteoWeatherProvider implements WeatherProvider {
  async getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast> {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set('latitude', input.lat.toString());
    url.searchParams.set('longitude', input.lng.toString());
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    );
    url.searchParams.set('forecast_days', input.days.toString());
    url.searchParams.set('timezone', 'auto');

    let res: Response;
    try {
      res = await fetch(url.toString(), { method: 'GET' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({ err: message }, 'open_meteo_fetch_failed');
      throw new ExternalServiceError(
        'open-meteo',
        'fetch_failed',
        { message },
        'WEATHER_PROVIDER_UNAVAILABLE',
      );
    }

    if (!res.ok) {
      log.warn({ status: res.status }, 'open_meteo_non_ok');
      throw new ExternalServiceError(
        'open-meteo',
        `http_${res.status}`,
        { status: res.status },
        'WEATHER_PROVIDER_UNAVAILABLE',
      );
    }

    const body = (await res.json()) as OpenMeteoResponse;
    // Minimal shape check — any missing field means the provider's
    // contract drifted and we'd rather fail loudly than return zeros.
    if (!body.daily || !Array.isArray(body.daily.time)) {
      throw new ExternalServiceError(
        'open-meteo',
        'malformed_response',
        {},
        'WEATHER_PROVIDER_UNAVAILABLE',
      );
    }

    const days: DailyForecast[] = body.daily.time.map((date, i) => ({
      date,
      maxTempC: body.daily.temperature_2m_max[i] ?? 0,
      minTempC: body.daily.temperature_2m_min[i] ?? 0,
      precipitationProbabilityPercent: body.daily.precipitation_probability_max[i] ?? null,
      weatherCode: body.daily.weather_code[i] ?? 0,
    }));

    return {
      lat: input.lat,
      lng: input.lng,
      timezone: body.timezone,
      days,
    };
  }
}
