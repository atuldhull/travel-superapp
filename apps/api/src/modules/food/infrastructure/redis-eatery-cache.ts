/**
 * Redis-backed `EateryCache`. Third instance of the cache-around-
 * port pattern (Weather + Stays + Food). After this one ships,
 * the shared `@app/cache` extraction is worth its own slice — the
 * three implementations are identical except for prefix + stored
 * type.
 *
 * Copy of `RedisStayCache` — same ensureConnected guard, same
 * swallow-and-log failure policy, own ioredis client (isolated
 * failure domain).
 *
 * Installed by prompt [IV.18.7.1].
 */
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import type { EateryListing } from '../domain/eatery-listing.entity';
import type { EateryCache } from '../application/ports/eatery-cache';

const log = createLogger('food.cache');

@Injectable()
export class RedisEateryCache implements EateryCache, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      log.warn({ err: err.message }, 'eatery_cache_redis_error');
    });
    const env = config.get('NODE_ENV', { infer: true });
    this.keyPrefix = `travel-${env}:eateries:`;
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

  async get(key: string): Promise<readonly EateryListing[] | null> {
    try {
      await this.ensureConnected();
      const raw = await this.redis.get(this.keyPrefix + key);
      if (!raw) return null;
      return JSON.parse(raw) as readonly EateryListing[];
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'eatery_cache_get_failed',
      );
      return null;
    }
  }

  async set(key: string, value: readonly EateryListing[], ttlSeconds: number): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.set(this.keyPrefix + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'eatery_cache_set_failed',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // quit may race; don't block shutdown.
    }
  }
}
