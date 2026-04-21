/**
 * Decorator over the upstream `WeatherProvider` that caches results
 * in `WEATHER_CACHE`. Keyed on `(lat, lng, days)` — coarse-grained
 * to 3 decimal places (~110m) so nearby callers share entries
 * without blowing up the keyspace.
 *
 * Cache TTL is `CACHE_TTL_SECONDS` (30 minutes) — balances quota
 * protection against forecasts going stale. Short enough that a
 * weather correction propagates to users within half an hour;
 * long enough that a hot trip-planner UI loop doesn't hammer the
 * provider.
 *
 * Wired at the `WEATHER_PROVIDER` token in `weather.module.ts` so
 * every downstream caller (direct `/weather/forecast` + Trip-weather
 * fold-in) gets caching transparently.
 *
 * Installed by prompt [IV.18.5.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import type { GetDailyForecastInput, WeatherProvider } from '../application/ports/weather-provider';
import { WEATHER_CACHE, type WeatherCache } from '../application/ports/weather-cache';
import type { WeatherForecast } from '../domain/weather-forecast.entity';
import { OpenMeteoWeatherProvider } from './open-meteo-provider';

const CACHE_TTL_SECONDS = 30 * 60;
const log = createLogger('weather.cached-provider');

@Injectable()
export class CachedWeatherProvider implements WeatherProvider {
  constructor(
    @Inject(OpenMeteoWeatherProvider) private readonly inner: WeatherProvider,
    @Inject(WEATHER_CACHE) private readonly cache: WeatherCache,
  ) {}

  async getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast> {
    const key = cacheKey(input);
    const cached = await this.cache.get(key);
    if (cached) {
      log.debug({ key }, 'weather_cache_hit');
      return cached;
    }
    const fresh = await this.inner.getDailyForecast(input);
    // Fire-and-forget at the domain level — `cache.set` already
    // swallows its own failures.
    await this.cache.set(key, fresh, CACHE_TTL_SECONDS);
    return fresh;
  }
}

function cacheKey(input: GetDailyForecastInput): string {
  // 3 decimal places ≈ 110m resolution. Good enough that two users
  // picking "the same cafe" share a cache entry; not so coarse that
  // cross-city forecasts collide.
  return `${input.lat.toFixed(3)}:${input.lng.toFixed(3)}:${input.days}`;
}
