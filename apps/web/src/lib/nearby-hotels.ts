/**
 * Best-rated stays near a place — $0, no key. Sourced from
 * **OpenStreetMap via the Overpass API** (same free-OSM ethos as the
 * tiles/routing/geocoder). We pull `tourism=hotel` nodes/ways around
 * a coordinate, rank by OSM `stars` (then name), and hand back a
 * **booking deep-link** per hotel: its own tagged website when OSM
 * has one, else a Booking.com search for "<hotel>, <city>".
 *
 * Honest by design: this is an OSM-derived shortlist + an outbound
 * search link — NOT live pricing/availability or an affiliate feed
 * (those need paid keys). The UI labels it as such.
 *
 * Resilient: a public-instance timeout falls back to the kumi
 * mirror; total failure → empty list (the section just hides).
 */
export interface NearbyHotel {
  readonly name: string;
  /** OSM star rating 1–5 when tagged, else null. */
  readonly stars: number | null;
  readonly lat: number;
  readonly lng: number;
  /** Where "Find rooms" goes (own site if tagged, else Booking search). */
  readonly bookingUrl: string;
  /** true = booking-search redirect (no live prices), false = own site. */
  readonly isSearchLink: boolean;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface OverpassEl {
  readonly type: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly center?: { readonly lat: number; readonly lon: number };
  readonly tags?: Record<string, string>;
}

function bookingSearch(name: string, city: string): string {
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(`${name}, ${city}`)}`;
}

async function runOverpass(query: string): Promise<OverpassEl[] | null> {
  for (const ep of ENDPOINTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(ep, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: ctrl.signal,
      });
      if (!res.ok) continue;
      const j = (await res.json()) as { elements?: OverpassEl[] };
      return j.elements ?? [];
    } catch {
      /* try next mirror */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Top stays within `radiusM` of (lat,lng), best OSM rating first.
 * `city` only shapes the Booking fallback query. Never throws.
 */
export async function nearbyHotels(
  lat: number,
  lng: number,
  city: string,
  opts: { radiusM?: number; limit?: number } = {},
): Promise<readonly NearbyHotel[]> {
  const radius = opts.radiusM ?? 4000;
  const limit = opts.limit ?? 6;
  const q =
    `[out:json][timeout:20];` +
    `(node["tourism"="hotel"]["name"](around:${radius},${lat},${lng});` +
    `way["tourism"="hotel"]["name"](around:${radius},${lat},${lng}););` +
    `out center 40;`;
  const els = await runOverpass(q);
  if (!els) return [];

  const seen = new Set<string>();
  const hotels: NearbyHotel[] = [];
  for (const el of els) {
    const t = el.tags ?? {};
    const name = t['name'];
    if (!name) continue;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const plat = el.lat ?? el.center?.lat;
    const plng = el.lon ?? el.center?.lon;
    if (plat === undefined || plng === undefined) continue;
    const starsRaw = Number.parseInt(t['stars'] ?? '', 10);
    const stars = Number.isFinite(starsRaw) && starsRaw >= 1 && starsRaw <= 5 ? starsRaw : null;
    const site = t['website'] ?? t['contact:website'] ?? '';
    const ownSite = /^https?:\/\//i.test(site);
    hotels.push({
      name,
      stars,
      lat: plat,
      lng: plng,
      bookingUrl: ownSite ? site : bookingSearch(name, city),
      isSearchLink: !ownSite,
    });
  }
  hotels.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.name.localeCompare(b.name));
  return hotels.slice(0, limit);
}
