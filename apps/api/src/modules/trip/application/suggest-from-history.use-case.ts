/**
 * V.UX.30 — destination suggestions seeded from the caller's past
 * trips. Reads up to N most-recent trips (active + archived), buckets
 * each by its center geo-region (a coarse continent slice), then
 * returns up to 3 suggested destinations + a one-line "why" anchor
 * from the closest historical trip.
 *
 * v1 implementation is editorial — we ship a small curated catalog
 * of destinations + a content-based filter that picks the best 3
 * matches by latitude band. Later we'll replace with the AI service
 * once trip-history embeddings land.
 *
 * The endpoint is auth-only (the suggestions reference the caller's
 * own trip history). Returns an empty list for users with no trips.
 *
 * Installed by prompt [V.UX.30].
 */
import { Inject, Injectable } from '@nestjs/common';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';
import { GeoQueries } from '../../../common/db/geo-queries';

interface CatalogEntry {
  readonly destination: string;
  readonly countryCode: string;
  readonly lat: number;
  readonly lng: number;
  readonly hook: string;
}

const CATALOG: readonly CatalogEntry[] = [
  {
    destination: 'Lisbon, Portugal',
    countryCode: 'PT',
    lat: 38.72,
    lng: -9.14,
    hook: 'Sun, custard tarts, and a digital-nomad scene rivaling Bali.',
  },
  {
    destination: 'Mexico City, Mexico',
    countryCode: 'MX',
    lat: 19.43,
    lng: -99.13,
    hook: 'Street food, museums, and a 3-hour flight from most of the US.',
  },
  {
    destination: 'Chiang Mai, Thailand',
    countryCode: 'TH',
    lat: 18.79,
    lng: 98.99,
    hook: 'Slow mountain pace, $5 massages, and the best larb in SE Asia.',
  },
  {
    destination: 'Tbilisi, Georgia',
    countryCode: 'GE',
    lat: 41.72,
    lng: 44.78,
    hook: 'A 1-year visa-free stay + a wine country a Bordeaux-lover would respect.',
  },
  {
    destination: 'Tokyo, Japan',
    countryCode: 'JP',
    lat: 35.68,
    lng: 139.65,
    hook: 'Order a bowl of ramen, watch the cherry blossoms drift past Yoyogi.',
  },
  {
    destination: 'Marrakesh, Morocco',
    countryCode: 'MA',
    lat: 31.63,
    lng: -7.99,
    hook: 'Souks, riads, the Atlas Mountains a day-trip away.',
  },
];

export interface DestinationSuggestion {
  readonly destination: string;
  readonly countryCode: string;
  readonly lat: number;
  readonly lng: number;
  readonly hook: string;
  /** "Because you visited Bali in 2024" — sourced from the closest
   *  historical trip's title. Null when the user has no past trips. */
  readonly anchor: string | null;
}

@Injectable()
export class SuggestFromHistoryUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
  ) {}

  async execute(userId: string): Promise<readonly DestinationSuggestion[]> {
    // Look at up to 25 past trips (active + archived) — enough signal
    // for a 3-suggestion list without scanning the whole history.
    const [active, archived] = await Promise.all([
      this.trips.listByUser(userId, 25, false),
      this.trips.listByUser(userId, 25, true),
    ]);
    const all = [...active, ...archived];
    if (all.length === 0) {
      // First-trip user: surface 3 globally-popular destinations.
      return CATALOG.slice(0, 3).map((c) => ({ ...c, anchor: null }));
    }
    // Pull centers for the past trips. GeoQueries.findTripCenter
    // returns one at a time — for 25 trips that's still 25 round-trips,
    // but the suggestion endpoint isn't hot-path. Cache later if it
    // gets called from a render loop.
    const centers = await Promise.all(
      all.map(async (t) => ({ trip: t, center: await this.geo.findTripCenter(t.id) })),
    );
    const seen = new Set<string>();
    const ranked = CATALOG.map((cat) => {
      // Score by minimum great-circle distance to any past trip center.
      // Lower distance = stronger "near where they've been" signal.
      let bestKm = Infinity;
      let anchorTitle: string | null = null;
      for (const { trip, center } of centers) {
        if (!center) continue;
        const km = haversineKm(cat.lat, cat.lng, center.lat, center.lng);
        if (km < bestKm) {
          bestKm = km;
          anchorTitle = trip.title;
        }
      }
      return { cat, bestKm, anchorTitle };
    })
      .filter((r) => !seen.has(r.cat.countryCode) && (seen.add(r.cat.countryCode), true))
      // Sort ascending by distance — closer to past trips ranks higher
      // (the user's already shown a preference for that part of the world).
      .sort((a, b) => a.bestKm - b.bestKm)
      .slice(0, 3);

    return ranked.map((r) => ({
      ...r.cat,
      anchor: r.anchorTitle ? `Because you visited "${r.anchorTitle}"` : null,
    }));
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
