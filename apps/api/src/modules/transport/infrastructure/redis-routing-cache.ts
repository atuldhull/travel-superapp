/**
 * Redis-backed `RoutingCache`. Sixth consumer of
 * `TypedRedisCache<T>` — same ~10-line subclass shape as the
 * previous five.
 *
 * Installed by prompt [IV.18.10.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TypedRedisCache } from '../../../common/cache/typed-redis-cache';
import type { RouteLeg } from '../domain/route-leg.entity';
import type { RoutingCache } from '../application/ports/routing-cache';

@Injectable()
export class RedisRoutingCache
  extends TypedRedisCache<readonly RouteLeg[]>
  implements RoutingCache
{
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'routing', 'transport.cache');
  }
}
