/**
 * Google Places (New) adapter — paid; off-by-default.
 *
 * Calls Places API v1 `places:searchNearby` when `GOOGLE_PLACES_API_KEY`
 * is set; otherwise reports `enabled=false` and the worker skips this
 * provider (matches B1's pattern across Resend/Twilio/web-push).
 *
 * The v1 endpoint uses an FieldMask header for response shaping — we
 * request only the fields we surface as CrawlHit. Quota: the operator's
 * Google Cloud project decides per-call cost.
 *
 * Installed by [S-B3] of the S-series real-functionality closeout.
 */
import { CircuitBreaker } from '@app/resilience';
import { SYSTEM_CLOCK } from '@app/clock';
import type { AppLogger } from '@app/logger';
import type { CrawlHit, ProviderQuery } from './types';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.types',
  'places.formattedAddress',
].join(',');

interface PlacesResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    types?: string[];
    formattedAddress?: string;
  }>;
}

export class GooglePlacesProvider {
  readonly name = 'google-places';
  private readonly apiKey: string | undefined;
  private readonly breaker: CircuitBreaker;

  constructor(apiKey: string | undefined = process.env.GOOGLE_PLACES_API_KEY) {
    this.apiKey = apiKey;
    this.breaker = new CircuitBreaker({
      name: 'crawler-worker:google-places',
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
    let response: Response;
    try {
      response = await this.breaker.exec(async () =>
        fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey!,
            'x-goog-fieldmask': FIELD_MASK,
          },
          body: JSON.stringify({
            locationRestriction: {
              circle: {
                center: { latitude: q.lat, longitude: q.lng },
                radius: q.radiusM,
              },
            },
            maxResultCount: 20,
          }),
          signal: AbortSignal.timeout(15_000),
        }),
      );
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'google-places transport error');
      return [];
    }
    if (!response.ok) {
      logger.warn({ status: response.status }, 'google-places non-200');
      return [];
    }
    let payload: PlacesResponse;
    try {
      payload = (await response.json()) as PlacesResponse;
    } catch {
      logger.warn('google-places returned non-JSON');
      return [];
    }
    return (payload.places ?? [])
      .filter((p) => p.id && p.location && p.displayName?.text)
      .map((p) => {
        const lat = p.location!.latitude!;
        const lng = p.location!.longitude!;
        return {
          provider: this.name,
          externalId: `gplaces/${p.id!}`,
          name: p.displayName!.text!,
          lat,
          lng,
          category: p.types?.[0] ?? 'place',
          distanceMeters: haversineMeters(q.lat, q.lng, lat, lng),
          address: p.formattedAddress ?? null,
        } satisfies CrawlHit;
      });
  }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
