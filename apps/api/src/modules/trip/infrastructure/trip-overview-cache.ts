/**
 * Redis-backed cache for the assembled `GET /trips/:id/overview`
 * DTO. Trip overview is the heaviest composite endpoint (7
 * concurrent sub-fetches: itinerary, weather, stays, eateries,
 * events, transport, media), so a 60-second TTL gives first-page
 * load latency a 5-10× win without hurting freshness for any
 * meaningful UX.
 *
 * **Cache key shape: `<tripId>:<userId>`.**
 *
 * Including the userId in the key — even though TripOverview is
 * trip-scoped data — makes the cache safe under collab-trip
 * sharing semantics. A TripShare grant or revoke for some other
 * user CAN'T leak a stale "you have access" view to them: their
 * cache key is independent.
 *
 * The slight cost is duplicate cached payloads when 2+ users
 * collab on the same trip, but the inputs are identical so the
 * de-duplication win is small. Per-user keying simplifies the
 * auth posture more than enough to be worth it.
 *
 * **Cache type: `unknown`.** The DTO shape lives in the
 * controller; serializing it through JSON is lossless because
 * every field is a primitive (strings, numbers, arrays of those).
 * The controller casts `unknown` → `TripOverviewDto` on read.
 *
 * **Invalidation: TTL-only.** Trip-balances was a write-invalidated
 * cache because expense writes are localized; trip-overview blends
 * 7+ data sources, so a write-invalidation pattern would require
 * hooking every writer in every module. Not worth it for a 60s
 * staleness window.
 *
 * Installed by prompt [IV.18.2.15].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { TypedRedisCache } from '../../../common/cache/typed-redis-cache';

@Injectable()
export class TripOverviewCache extends TypedRedisCache<unknown> {
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super(config, 'trip-overview', 'trip.overview.cache');
  }
}

/**
 * 60-second TTL. Long enough that a tab refresh / nav-back hits
 * the warmed cache; short enough that itinerary edits and new
 * stays show up "promptly" without explicit invalidation.
 */
export const TRIP_OVERVIEW_CACHE_TTL_SEC = 60;
