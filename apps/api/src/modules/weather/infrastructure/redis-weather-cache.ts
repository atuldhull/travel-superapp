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
import type { WeatherForecast } from '../domain/weather-forecast.entity';
import type { WeatherCache } from '../application/ports/weather-cache';

@Injectable()
export class RedisWeatherCache extends TypedRedisCache<WeatherForecast> implements WeatherCache {
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'weather', 'weather.cache');
  }
}
