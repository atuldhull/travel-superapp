/**
 * Redis-backed `WeatherCache`. Thin subclass of the shared
 * `TypedRedisCache<T>` base ([IV.18.8.1]); namespace + logger name
 * are the only per-module customizations.
 *
 * Installed by prompt [IV.18.5.2]; collapsed onto the shared base
 * in prompt [IV.18.8.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TypedRedisCache } from '../../../common/cache/typed-redis-cache';
import type { HourlyWeatherForecast, WeatherForecast } from '../domain/weather-forecast.entity';
import type { WeatherCache } from '../application/ports/weather-cache';

const HOURLY_PREFIX = 'hourly:';

@Injectable()
export class RedisWeatherCache extends TypedRedisCache<WeatherForecast> implements WeatherCache {
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'weather', 'weather.cache');
  }

  // V.UX.21 — hourly forecasts share the same Redis backend but live
  // under a distinct key prefix so daily + hourly entries don't
  // collide. The base class is generic over a single T, so we cast
  // at the boundary; both shapes serialise as plain JSON.
  async getHourly(key: string): Promise<HourlyWeatherForecast | null> {
    const raw = await this.get(HOURLY_PREFIX + key);
    return raw as unknown as HourlyWeatherForecast | null;
  }

  async setHourly(key: string, value: HourlyWeatherForecast, ttlSeconds: number): Promise<void> {
    await this.set(HOURLY_PREFIX + key, value as unknown as WeatherForecast, ttlSeconds);
  }
}
