/**
 * Redis-backed `StayCache`. Thin subclass of the shared
 * `TypedRedisCache<T>` base ([IV.18.8.1]).
 *
 * Installed by prompt [IV.18.6.1]; collapsed onto the shared base
 * in prompt [IV.18.8.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TypedRedisCache } from '../../../common/cache/typed-redis-cache';
import type { StayListing } from '../domain/stay-listing.entity';
import type { StayCache } from '../application/ports/stay-cache';

@Injectable()
export class RedisStayCache extends TypedRedisCache<readonly StayListing[]> implements StayCache {
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'stays', 'stays.cache');
  }
}
