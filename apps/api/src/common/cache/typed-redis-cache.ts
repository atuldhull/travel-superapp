/**
 * Shared Redis cache base class. Extracts the get/set/ensureConnected
 * machinery that Weather + Stays + Food each had their own ~70-line
 * copy of.
 *
 * Each module-specific cache is now a ~10-line subclass that just
 * provides its namespace + logger name:
 *
 *   @Injectable()
 *   export class RedisWeatherCache
 *     extends TypedRedisCache<WeatherForecast>
 *     implements WeatherCache
 *   {
 *     constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
 *       super(config, 'weather', 'weather.cache');
 *     }
 *   }
 *
 * Design choices:
 *   - **Abstract class, not factory function**: NestJS DI resolves
 *     by class token, and inject-in-constructor is the native path.
 *     A factory would force every consumer to use `{ provide: X,
 *     useFactory: ... }` — more ceremony.
 *   - **Own ioredis client per instance**: mirrors the isolated
 *     failure domain pattern `RedisThrottlerStorage` uses. A shared
 *     client would couple cache invalidation across unrelated
 *     namespaces.
 *   - **Swallow-and-log on failure**: a dead cache degrades to
 *     "no cache" (the caller returns the fresh value). Propagating
 *     would make a Redis outage take down the consumer endpoint.
 *   - **`ensureConnected()` guard**: `lazyConnect: true` +
 *     `enableOfflineQueue: false` means commands fail instantly
 *     until status leaves `wait`/`end`/`close`. Same trick
 *     `RedisThrottlerStorage` uses.
 *   - **Lives in `common/cache/`, not `@app/cache`**: no second app
 *     needs this yet. Promote to a workspace package when
 *     `notification-worker` or `crawler-worker` grow a cache, which
 *     is not today.
 *
 * Installed by prompt [IV.18.8.1].
 */
import { Inject, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';

type PinoLogger = ReturnType<typeof createLogger>;

export abstract class TypedRedisCache<T> implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  protected readonly namespace: string;
  protected readonly log: PinoLogger;

  protected constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    namespace: string,
    loggerName: string,
  ) {
    this.namespace = namespace;
    this.log = createLogger(loggerName);
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      this.log.warn({ err: err.message }, `${namespace}_cache_redis_error`);
    });
    const env = config.get('NODE_ENV', { infer: true });
    this.keyPrefix = `travel-${env}:${namespace}:`;
  }

  private async ensureConnected(): Promise<void> {
    if (
      this.redis.status === 'wait' ||
      this.redis.status === 'end' ||
      this.redis.status === 'close'
    ) {
      await this.redis.connect();
    }
  }

  async get(key: string): Promise<T | null> {
    try {
      await this.ensureConnected();
      const raw = await this.redis.get(this.keyPrefix + key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        `${this.namespace}_cache_get_failed`,
      );
      return null;
    }
  }

  async set(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.set(this.keyPrefix + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        `${this.namespace}_cache_set_failed`,
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
