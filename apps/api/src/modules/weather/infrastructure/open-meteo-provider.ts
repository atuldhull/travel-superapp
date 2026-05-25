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
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import { ExternalServiceError } from '@app/errors';
import { createLogger } from '@app/logger';
import { CircuitBreaker, CircuitOpenError, withTimeout } from '@app/resilience';
import type {
  DailyForecast,
  HourlyForecast,
  HourlyWeatherForecast,
  WeatherForecast,
} from '../domain/weather-forecast.entity';
import type {
  GetDailyForecastInput,
  GetHourlyForecastInput,
  WeatherProvider,
} from '../application/ports/weather-provider';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const log = createLogger('weather.open-meteo');
// [N8] External-call hardening — Open-Meteo is a free, keyless API
// with NO SLA. Without a circuit breaker, one hiccup at the upstream
// cascaded into 5xx on every /near-me / /forecast call until the
// upstream healed (the review's "near-me 502 from a weather hiccup"
// example). Now: a 5-failure streak opens the breaker for 30s; the
// 31st-second probe either re-closes (upstream healed) or re-opens
// (still down). Routes can catch `CircuitOpenError` and serve a
// cached / null-fallback instead of 5xx-ing.
const REQUEST_TIMEOUT_MS = 5_000;

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

interface OpenMeteoHourly {
  readonly time: readonly string[];
  readonly temperature_2m: readonly number[];
  readonly precipitation_probability: ReadonlyArray<number | null>;
  readonly wind_speed_10m: ReadonlyArray<number | null>;
  readonly weather_code: readonly number[];
}

interface OpenMeteoHourlyResponse {
  readonly timezone: string;
  readonly hourly: OpenMeteoHourly;
}

@Injectable()
export class OpenMeteoWeatherProvider implements WeatherProvider {
  private readonly breaker: CircuitBreaker;

  constructor(@Inject(CLOCK) private readonly clock: Clock) {
    this.breaker = new CircuitBreaker({
      name: 'open-meteo',
      clock,
      // 5 consecutive 5xx / fetch failures opens for 30s. The Stub
      // doesn't get to set this — these are the production defaults.
      failureThreshold: 5,
      openMs: 30_000,
      // Don't count "valid but empty response" cases (4xx-shaped
      // problems from the caller) toward the failure streak. Our
      // `ExternalServiceError` carries `http_<status>` as `reason`
      // when the response was non-2xx; treat 5xx + fetch_failed as
      // upstream-fault, everything else as caller-fault.
      isFailure: (err) => {
        if (!(err instanceof ExternalServiceError)) return false;
        // The 2nd ctor arg of ExternalServiceError is the upstream
        // reason ("fetch_failed", "http_503", etc.) and lands on
        // `.message`. Count anything that smells like upstream-fault
        // (network / 5xx / contract drift) toward the failure
        // streak; 4xx is caller-bug and not the breaker's job.
        const reason = err.message;
        return (
          reason === 'fetch_failed' ||
          reason === 'malformed_response' ||
          reason.startsWith('http_5')
        );
      },
      onTransition: (from, to, name) => log.warn({ from, to, name }, 'circuit_state_change'),
    });
  }

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

    let body: OpenMeteoResponse;
    try {
      body = await this.breaker.exec(async () => {
        let res: Response;
        try {
          res = await withTimeout(
            fetch(url.toString(), { method: 'GET' }),
            REQUEST_TIMEOUT_MS,
            'open-meteo daily',
          );
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
        return (await res.json()) as OpenMeteoResponse;
      });
    } catch (err) {
      // Translate CircuitOpenError into the same ExternalServiceError
      // shape callers already handle — they get a uniform "weather
      // unavailable" instead of a new error class to thread.
      if (err instanceof CircuitOpenError) {
        log.warn(
          { circuit: err.circuitName, nextProbeAt: err.nextProbeAt },
          'open_meteo_circuit_open',
        );
        throw new ExternalServiceError(
          'open-meteo',
          'circuit_open',
          { nextProbeAt: err.nextProbeAt },
          'WEATHER_PROVIDER_UNAVAILABLE',
        );
      }
      throw err;
    }
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

  /**
   * V.UX.21 — hourly forecast for the adventure persona. Same
   * Open-Meteo `/v1/forecast` endpoint, but with the `hourly=...`
   * query string and `forecast_days` set to ceil(hours/24) so we
   * pull just enough days to satisfy the requested window. The
   * response is then trimmed to exactly `input.hours` rows.
   */
  async getHourlyForecast(input: GetHourlyForecastInput): Promise<HourlyWeatherForecast> {
    const days = Math.max(1, Math.min(16, Math.ceil(input.hours / 24)));
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set('latitude', input.lat.toString());
    url.searchParams.set('longitude', input.lng.toString());
    url.searchParams.set(
      'hourly',
      'temperature_2m,precipitation_probability,wind_speed_10m,weather_code',
    );
    url.searchParams.set('forecast_days', days.toString());
    url.searchParams.set('timezone', 'auto');

    let body: OpenMeteoHourlyResponse;
    try {
      body = await this.breaker.exec(async () => {
        let res: Response;
        try {
          res = await withTimeout(
            fetch(url.toString(), { method: 'GET' }),
            REQUEST_TIMEOUT_MS,
            'open-meteo hourly',
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.warn({ err: message }, 'open_meteo_hourly_fetch_failed');
          throw new ExternalServiceError(
            'open-meteo',
            'fetch_failed',
            { message },
            'WEATHER_PROVIDER_UNAVAILABLE',
          );
        }
        if (!res.ok) {
          log.warn({ status: res.status }, 'open_meteo_hourly_non_ok');
          throw new ExternalServiceError(
            'open-meteo',
            `http_${res.status}`,
            { status: res.status },
            'WEATHER_PROVIDER_UNAVAILABLE',
          );
        }
        return (await res.json()) as OpenMeteoHourlyResponse;
      });
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        log.warn(
          { circuit: err.circuitName, nextProbeAt: err.nextProbeAt },
          'open_meteo_hourly_circuit_open',
        );
        throw new ExternalServiceError(
          'open-meteo',
          'circuit_open',
          { nextProbeAt: err.nextProbeAt },
          'WEATHER_PROVIDER_UNAVAILABLE',
        );
      }
      throw err;
    }
    if (!body.hourly || !Array.isArray(body.hourly.time)) {
      throw new ExternalServiceError(
        'open-meteo',
        'malformed_response',
        {},
        'WEATHER_PROVIDER_UNAVAILABLE',
      );
    }

    const hours: HourlyForecast[] = body.hourly.time.slice(0, input.hours).map((time, i) => ({
      time,
      tempC: body.hourly.temperature_2m[i] ?? 0,
      precipitationProbabilityPercent: body.hourly.precipitation_probability[i] ?? null,
      windSpeedKmh: body.hourly.wind_speed_10m[i] ?? null,
      weatherCode: body.hourly.weather_code[i] ?? 0,
    }));

    return {
      lat: input.lat,
      lng: input.lng,
      timezone: body.timezone,
      hours,
    };
  }
}
