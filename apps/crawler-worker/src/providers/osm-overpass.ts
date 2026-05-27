/**
 * OSM Overpass adapter — $0, no key, always enabled.
 *
 * Overpass is the open-street-map query API. We POST a tiny QL script
 * that asks for `tourism` / `amenity` / `historic` nodes + ways within
 * `radiusM` of (lat, lng). Default endpoint is the public free one;
 * operators can self-host overpass-api against a regional extract and
 * point `OVERPASS_URL` at it to bypass the public rate-limits.
 *
 * Conservative: 25s timeout, 50 results max, cap radius at 2km so a
 * mis-configured caller doesn't drag down the public server.
 *
 * Installed by [S-B3] of the S-series real-functionality closeout.
 */
import { CircuitBreaker } from '@app/resilience';
import { SYSTEM_CLOCK } from '@app/clock';
import type { AppLogger } from '@app/logger';
import type { CrawlHit, ProviderQuery } from './types';

const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_RADIUS_M = 2_000;
const RESULT_CAP = 50;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export class OverpassProvider {
  readonly name = 'osm';
  private readonly endpoint: string;
  private readonly breaker: CircuitBreaker;

  constructor(endpoint = process.env.OVERPASS_URL ?? DEFAULT_OVERPASS_URL) {
    this.endpoint = endpoint;
    // Public Overpass is sometimes flaky / rate-limited. Permissive
    // threshold but short open window — re-probe quickly when the
    // upstream recovers.
    this.breaker = new CircuitBreaker({
      name: 'crawler-worker:overpass',
      failureThreshold: 8,
      openMs: 60_000,
      clock: SYSTEM_CLOCK,
    });
  }

  get enabled(): boolean {
    return true;
  }

  async fetch(q: ProviderQuery, logger: AppLogger): Promise<readonly CrawlHit[]> {
    const radius = Math.min(MAX_RADIUS_M, Math.max(50, q.radiusM));
    const script = `
[out:json][timeout:25];
(
  node["tourism"](around:${radius},${q.lat},${q.lng});
  node["amenity"](around:${radius},${q.lat},${q.lng});
  node["historic"](around:${radius},${q.lat},${q.lng});
  way["tourism"](around:${radius},${q.lat},${q.lng});
  way["amenity"](around:${radius},${q.lat},${q.lng});
);
out center ${RESULT_CAP};
`;

    let response: Response;
    try {
      response = await this.breaker.exec(async () =>
        fetch(this.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(script)}`,
          signal: AbortSignal.timeout(25_000),
        }),
      );
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'overpass transport error');
      return [];
    }
    if (!response.ok) {
      logger.warn(
        { status: response.status, body: await safePreview(response) },
        'overpass non-200',
      );
      return [];
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      logger.warn('overpass returned non-JSON body');
      return [];
    }
    const elements = (payload as { elements?: OverpassElement[] }).elements ?? [];
    const hits: CrawlHit[] = [];
    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat === undefined || lng === undefined) continue;
      const tags = el.tags ?? {};
      const name = tags['name'] ?? tags['name:en'];
      if (!name) continue;
      hits.push({
        provider: this.name,
        externalId: `${el.type}/${el.id}`,
        name,
        lat,
        lng,
        category: tags['tourism'] ?? tags['amenity'] ?? tags['historic'] ?? 'place',
        distanceMeters: haversineMeters(q.lat, q.lng, lat, lng),
        address: composeAddress(tags),
      });
    }
    // Apply the name-hint filter if the caller provided one — Overpass
    // doesn't support fuzzy text queries server-side, so we filter here.
    if (q.nameHint) {
      const needle = q.nameHint.toLowerCase();
      return hits.filter((h) => h.name.toLowerCase().includes(needle));
    }
    return hits;
  }
}

async function safePreview(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return '<unreadable>';
  }
}

function composeAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:street'];
  const housenumber = tags['addr:housenumber'];
  const city = tags['addr:city'];
  const parts: string[] = [];
  if (housenumber && street) parts.push(`${housenumber} ${street}`);
  else if (street) parts.push(street);
  if (city) parts.push(city);
  return parts.length > 0 ? parts.join(', ') : null;
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
