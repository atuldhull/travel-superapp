/**
 * Redis-backed `WeatherCache`. Follows the same single-purpose
 * `new Redis()` client pattern as `RedisThrottlerStorage` —
 * isolated failure domain, each module owns its connection.
 *
 * Failure policy: swallow connection errors so the weather path
 * degrades to "no cache" rather than 500. A dead Redis shouldn't
 * take down the forecast endpoint.
 *
 * Installed by prompt [IV.18.5.2].
 */
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import type { WeatherForecast } from '../domain/weather-forecast.entity';
import type { WeatherCache } from '../application/ports/weather-cache';

const log = createLogger('weather.cache');

@Injectable()
export class RedisWeatherCache implements WeatherCache, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      log.warn({ err: err.message }, 'weather_cache_redis_error');
    });
    const env = config.get('NODE_ENV', { infer: true });
    this.keyPrefix = `travel-${env}:weather:`;
  }

  /**
   * Auto-connect guard — `lazyConnect: true` + `enableOfflineQueue:
   * false` combo means commands fail instantly when status is `wait`
   * / `end` / `close`. Same pattern `RedisThrottlerStorage` uses.
   */
  private async ensureConnected(): Promise<void> {
    if (
      this.redis.status === 'wait' ||
      this.redis.status === 'end' ||
      this.redis.status === 'close'
    ) {
      await this.redis.connect();
    }
  }

  async get(key: string): Promise<WeatherForecast | null> {
    try {
      await this.ensureConnected();
      const raw = await this.redis.get(this.keyPrefix + key);
      if (!raw) return null;
      return JSON.parse(raw) as WeatherForecast;
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'weather_cache_get_failed',
      );
      return null;
    }
  }

  async set(key: string, value: WeatherForecast, ttlSeconds: number): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.set(this.keyPrefix + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      // Best-effort. A write failure is logged but not propagated —
      // the caller already has the forecast in hand.
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'weather_cache_set_failed',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // quit may race with connection-failed state; don't block shutdown.
    }
  }
}
