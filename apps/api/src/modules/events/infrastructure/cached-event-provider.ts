/**
 * Decorator over `EventProvider` that caches results in
 * `EVENT_CACHE`. Every search parameter participates in the key.
 *
 * TTL 10 minutes — events have real-time churn: sold-out, cancelled,
 * postponed. Shorter TTL than Weather/Stays/Food's 30-min default;
 * hot-path UX (e.g., "events tonight") benefits more from fresh
 * than from quota savings.
 *
 * Installed by prompt [IV.18.9.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import type { EventListing } from '../domain/event-listing.entity';
import type { EventProvider, SearchEventsInput } from '../application/ports/event-provider';
import { EVENT_CACHE, type EventCache } from '../application/ports/event-cache';
import { MockEventProvider } from './mock-event-provider';

const CACHE_TTL_SECONDS = 10 * 60;
const log = createLogger('events.cached-provider');

@Injectable()
export class CachedEventProvider implements EventProvider {
  constructor(
    @Inject(MockEventProvider) private readonly inner: EventProvider,
    @Inject(EVENT_CACHE) private readonly cache: EventCache,
  ) {}

  async searchNearby(input: SearchEventsInput): Promise<readonly EventListing[]> {
    const key = cacheKey(input);
    const cached = await this.cache.get(key);
    if (cached) {
      log.debug({ key }, 'events_cache_hit');
      return cached;
    }
    const fresh = await this.inner.searchNearby(input);
    await this.cache.set(key, fresh, CACHE_TTL_SECONDS);
    return fresh;
  }
}

function cacheKey(input: SearchEventsInput): string {
  // Same 3-decimal coord coarsening the other 4 modules use.
  // V.UX.16 — `freeOnly` participates in the key so a free-only
  // query and an unfiltered query don't share a stale entry
  // (same lesson as the V.UX.15 stepFreeOnly fix).
  const free = input.freeOnly === true ? 'free' : '';
  return [
    input.lat.toFixed(3),
    input.lng.toFixed(3),
    input.radiusKm.toFixed(1),
    input.from,
    input.to,
    input.category ?? '',
    free,
  ].join(':');
}
