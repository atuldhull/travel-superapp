/**
 * Redis-backed `EateryCache`. Thin subclass of the shared
 * `TypedRedisCache<T>` base ([IV.18.8.1]).
 *
 * Installed by prompt [IV.18.7.1]; collapsed onto the shared base
 * in prompt [IV.18.8.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TypedRedisCache } from '../../../common/cache/typed-redis-cache';
import type { EateryListing } from '../domain/eatery-listing.entity';
import type { EateryCache } from '../application/ports/eatery-cache';

@Injectable()
export class RedisEateryCache
  extends TypedRedisCache<readonly EateryListing[]>
  implements EateryCache
{
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'eateries', 'food.cache');
  }
}
