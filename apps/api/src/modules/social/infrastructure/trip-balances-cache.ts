/**
 * Redis-backed cache for `GetTripBalancesUseCase` results. Thin
 * subclass of the shared `TypedRedisCache<T>` base.
 *
 * Key shape: `social:trip-balances:<tripId>`. The base class
 * adds the `travel-<env>:` prefix.
 *
 * Cached value is the `UserBalance[]` array — already a stable
 * 2-dp-string shape, so JSON serialization is deterministic.
 *
 * Invalidation: `CreateExpenseUseCase` + `DeleteExpenseUseCase`
 * call `del(tripId)` on every write. TTL is 5 minutes — a
 * cache that survives a missed invalidation (e.g. Redis
 * temporarily unavailable on the write path) self-heals on
 * the next read after the TTL window.
 *
 * Installed by prompt [IV.18.10.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TypedRedisCache } from '../../../common/cache/typed-redis-cache';
import type { UserBalance } from '../domain/expense.entity';

@Injectable()
export class TripBalancesCache extends TypedRedisCache<readonly UserBalance[]> {
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'trip-balances', 'social.trip-balances.cache');
  }
}
