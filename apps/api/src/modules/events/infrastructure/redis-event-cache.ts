/**
 * Redis-backed `EventCache`. Fifth consumer of the shared
 * `TypedRedisCache<T>` base. Same ~10-line subclass shape as
 * Weather/Stays/Food/Places.
 *
 * Installed by prompt [IV.18.9.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TypedRedisCache } from '../../../common/cache/typed-redis-cache';
import type { EventListing } from '../domain/event-listing.entity';
import type { EventCache } from '../application/ports/event-cache';

@Injectable()
export class RedisEventCache
  extends TypedRedisCache<readonly EventListing[]>
  implements EventCache
{
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'events', 'events.cache');
  }
}
