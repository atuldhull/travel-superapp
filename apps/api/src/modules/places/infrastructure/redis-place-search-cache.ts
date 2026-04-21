/**
 * Redis-backed `PlaceSearchCache`. Fourth consumer of the shared
 * `TypedRedisCache<T>` base — ~10 lines thanks to the extraction
 * in [IV.18.8.1].
 *
 * Installed by prompt [IV.18.4.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TypedRedisCache } from '../../../common/cache/typed-redis-cache';
import type { FederatedPlaceResult } from '../domain/federated-place-result.entity';
import type { PlaceSearchCache } from '../application/ports/place-search-cache';

@Injectable()
export class RedisPlaceSearchCache
  extends TypedRedisCache<readonly FederatedPlaceResult[]>
  implements PlaceSearchCache
{
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'places-search', 'places.cache');
  }
}
