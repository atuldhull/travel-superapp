/**
 * Decorator over `RoutingProvider` that caches results in
 * `ROUTING_CACHE`. Every search parameter participates in the key.
 *
 * TTL 10 minutes. Route durations depend on live traffic — the
 * shorter TTL balances "don't thrash the paid provider on a hot
 * planner UI" against "don't show 45-minute-old drive times during
 * rush hour."
 *
 * Installed by prompt [IV.18.10.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import type { RouteLeg } from '../domain/route-leg.entity';
import type { GetRoutesInput, RoutingProvider } from '../application/ports/routing-provider';
import { ROUTING_CACHE, type RoutingCache } from '../application/ports/routing-cache';
import { MockRoutingProvider } from './mock-routing-provider';

const CACHE_TTL_SECONDS = 10 * 60;
const log = createLogger('transport.cached-provider');

@Injectable()
export class CachedRoutingProvider implements RoutingProvider {
  constructor(
    @Inject(MockRoutingProvider) private readonly inner: RoutingProvider,
    @Inject(ROUTING_CACHE) private readonly cache: RoutingCache,
  ) {}

  async getRoutes(input: GetRoutesInput): Promise<readonly RouteLeg[]> {
    const key = cacheKey(input);
    const cached = await this.cache.get(key);
    if (cached) {
      log.debug({ key }, 'routing_cache_hit');
      return cached;
    }
    const fresh = await this.inner.getRoutes(input);
    await this.cache.set(key, fresh, CACHE_TTL_SECONDS);
    return fresh;
  }
}

function cacheKey(input: GetRoutesInput): string {
  // 4-decimal coord precision (~11m) — tighter than the 3-decimal
  // used by the place-search caches because routing legs are more
  // sensitive to small position shifts (origin across a road =
  // different leg). Sorted mode list so `[car, walk]` and
  // `[walk, car]` share a cache entry. V.UX.15 — `stepFreeOnly`
  // also participates so a stepFree query and a default query for
  // the same coords don't share a stale cache entry.
  const modes = input.modes ? [...input.modes].sort().join(',') : '';
  const stepFree = input.stepFreeOnly === true ? 'sf' : '';
  return [
    input.originLat.toFixed(4),
    input.originLng.toFixed(4),
    input.destinationLat.toFixed(4),
    input.destinationLng.toFixed(4),
    modes,
    stepFree,
  ].join(':');
}
