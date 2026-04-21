/**
 * Redis-backed `StayCache`. Copy of the `RedisWeatherCache` shape —
 * same ensureConnected guard, same swallow-and-log failure policy,
 * own client (isolated failure domain per feature).
 *
 * Installed by prompt [IV.18.6.1].
 */
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import type { StayListing } from '../domain/stay-listing.entity';
import type { StayCache } from '../application/ports/stay-cache';

const log = createLogger('stays.cache');

@Injectable()
export class RedisStayCache implements StayCache, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.redis = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      log.warn({ err: err.message }, 'stay_cache_redis_error');
    });
    const env = config.get('NODE_ENV', { infer: true });
    this.keyPrefix = `travel-${env}:stays:`;
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

  async get(key: string): Promise<readonly StayListing[] | null> {
    try {
      await this.ensureConnected();
      const raw = await this.redis.get(this.keyPrefix + key);
      if (!raw) return null;
      return JSON.parse(raw) as readonly StayListing[];
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : String(err) }, 'stay_cache_get_failed');
      return null;
    }
  }

  async set(key: string, value: readonly StayListing[], ttlSeconds: number): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.set(this.keyPrefix + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : String(err) }, 'stay_cache_set_failed');
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
