/**
 * Provider router — fan-out crawl across OSM + (optional) paid providers,
 * collate + de-duplicate by externalId.
 *
 * OSM Overpass is always enabled (free, no key); Google Places + FSQ
 * are gated on their API-key env vars — when absent they no-op silently.
 *
 * De-duplication picks the first hit per externalId; since each provider
 * uses its own id namespace (`osm/`, `gplaces/`, `fsq/`) collisions are
 * rare. Future work: cross-provider dedup by `(name + ~50m proximity)`.
 *
 * Installed by [S-B3] of the S-series real-functionality closeout.
 */
import type { AppLogger } from '@app/logger';
import { FoursquareProvider } from './foursquare';
import { GooglePlacesProvider } from './google-places';
import { OverpassProvider } from './osm-overpass';
import type { CrawlHit, ProviderQuery } from './types';

export interface CrawlSummary {
  readonly hits: readonly CrawlHit[];
  readonly perProvider: Record<string, number>;
  readonly skippedProviders: readonly string[];
  readonly elapsedMs: number;
}

export interface CrawlerRouter {
  /** Run all enabled providers in parallel and return collated hits. */
  crawl(query: ProviderQuery, logger: AppLogger): Promise<CrawlSummary>;
  /** Boot-log status snapshot. */
  status(): Record<string, boolean>;
}

export function buildCrawlerRouter(): CrawlerRouter {
  const providers = [
    new OverpassProvider(),
    new GooglePlacesProvider(),
    new FoursquareProvider(),
  ] as const;

  return {
    async crawl(query, logger): Promise<CrawlSummary> {
      const startedAt = Date.now();
      const enabled = providers.filter((p) => p.enabled);
      const skipped = providers.filter((p) => !p.enabled).map((p) => p.name);

      const results = await Promise.allSettled(enabled.map((p) => p.fetch(query, logger)));

      const seen = new Set<string>();
      const collated: CrawlHit[] = [];
      const perProvider: Record<string, number> = {};

      for (let i = 0; i < enabled.length; i++) {
        const provider = enabled[i]!;
        const r = results[i]!;
        if (r.status === 'rejected') {
          logger.warn({ provider: provider.name, err: String(r.reason) }, 'provider rejected');
          perProvider[provider.name] = 0;
          continue;
        }
        const hits = r.value;
        let kept = 0;
        for (const hit of hits) {
          if (seen.has(hit.externalId)) continue;
          seen.add(hit.externalId);
          collated.push(hit);
          kept++;
        }
        perProvider[provider.name] = kept;
      }

      collated.sort((a, b) => a.distanceMeters - b.distanceMeters);

      return {
        hits: collated,
        perProvider,
        skippedProviders: skipped,
        elapsedMs: Date.now() - startedAt,
      };
    },
    status(): Record<string, boolean> {
      return Object.fromEntries(providers.map((p) => [p.name, p.enabled]));
    },
  };
}
