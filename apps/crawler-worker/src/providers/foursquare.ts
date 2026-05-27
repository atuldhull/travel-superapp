/**
 * Foursquare Places adapter — paid; off-by-default.
 *
 * Calls FSQ Places v3 `places/search` when `FOURSQUARE_API_KEY` is set.
 * Free tier covers ~1k req/day; ops opt in by setting the env var.
 *
 * Installed by [S-B3] of the S-series real-functionality closeout.
 */
import { CircuitBreaker } from '@app/resilience';
import { SYSTEM_CLOCK } from '@app/clock';
import type { AppLogger } from '@app/logger';
import type { CrawlHit, ProviderQuery } from './types';

const ENDPOINT = 'https://api.foursquare.com/v3/places/search';

interface FsqResponse {
  results?: Array<{
    fsq_id?: string;
    name?: string;
    geocodes?: { main?: { latitude?: number; longitude?: number } };
    distance?: number;
    location?: { formatted_address?: string };
    categories?: Array<{ name?: string }>;
  }>;
}

export class FoursquareProvider {
  readonly name = 'foursquare';
  private readonly apiKey: string | undefined;
  private readonly breaker: CircuitBreaker;

  constructor(apiKey: string | undefined = process.env.FOURSQUARE_API_KEY) {
    this.apiKey = apiKey;
    this.breaker = new CircuitBreaker({
      name: 'crawler-worker:foursquare',
      failureThreshold: 5,
      openMs: 30_000,
      clock: SYSTEM_CLOCK,
    });
  }

  get enabled(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async fetch(q: ProviderQuery, logger: AppLogger): Promise<readonly CrawlHit[]> {
    if (!this.enabled) return [];
    const url = `${ENDPOINT}?ll=${q.lat},${q.lng}&radius=${q.radiusM}&limit=30${
      q.nameHint ? `&query=${encodeURIComponent(q.nameHint)}` : ''
    }`;
    let response: Response;
    try {
      response = await this.breaker.exec(async () =>
        fetch(url, {
          method: 'GET',
          headers: { authorization: this.apiKey!, accept: 'application/json' },
          signal: AbortSignal.timeout(15_000),
        }),
      );
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'foursquare transport error');
      return [];
    }
    if (!response.ok) {
      logger.warn({ status: response.status }, 'foursquare non-200');
      return [];
    }
    let payload: FsqResponse;
    try {
      payload = (await response.json()) as FsqResponse;
    } catch {
      logger.warn('foursquare returned non-JSON');
      return [];
    }
    return (payload.results ?? [])
      .filter((r) => r.fsq_id && r.name && r.geocodes?.main?.latitude !== undefined)
      .map((r) => ({
        provider: this.name,
        externalId: `fsq/${r.fsq_id!}`,
        name: r.name!,
        lat: r.geocodes!.main!.latitude!,
        lng: r.geocodes!.main!.longitude!,
        category: r.categories?.[0]?.name ?? 'place',
        distanceMeters: r.distance ?? 0,
        address: r.location?.formatted_address ?? null,
      }));
  }
}
