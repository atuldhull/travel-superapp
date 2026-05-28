/**
 * Free, key-less place geocoding. Primary: **Photon** (komoot,
 * photon.komoot.io) — open-source, no key, CORS-open, built for
 * type-ahead and FAR more lenient than Nominatim's public endpoint
 * (which 429s under the rapid lookups an itinerary needs, leaving the
 * globe empty). Fallback: Nominatim, one shot, if Photon misses.
 *
 * Same $0 / no-key ethos as the OSM tiles + OSRM routing. Always
 * resolves (never throws): a miss → empty list / null so the UI
 * degrades gracefully instead of erroring.
 */
export interface GeoPlace {
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

const PHOTON = 'https://photon.komoot.io/api/';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

interface PhotonResp {
  readonly features?: ReadonlyArray<{
    readonly geometry?: { readonly coordinates?: readonly [number, number] };
    readonly properties?: {
      readonly name?: string;
      readonly housenumber?: string;
      readonly street?: string;
      readonly district?: string;
      readonly city?: string;
      readonly county?: string;
      readonly state?: string;
      readonly postcode?: string;
      readonly country?: string;
    };
  }>;
}
interface NominatimRow {
  readonly display_name?: string;
  readonly lat?: string;
  readonly lon?: string;
}

async function timedFetch(url: string, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Google-Maps-style precise label: house+street (or POI name), then
// area → city → state → postcode → country, de-duped so distinct
// matches read distinctly instead of "New Delhi, Delhi, India" ×5.
function photonLabel(p: NonNullable<PhotonResp['features']>[number]['properties']): string {
  if (!p) return '';
  const head =
    p.housenumber && p.street ? `${p.housenumber} ${p.street}` : (p.name ?? p.street ?? '');
  const parts = [head, p.district, p.city, p.county, p.state, p.postcode, p.country];
  const seen = new Set<string>();
  return parts
    .map((s) => (s ?? '').trim())
    .filter((s) => {
      const k = s.toLowerCase();
      if (!s || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(', ');
}

/**
 * Search places (type-ahead). Photon first, Nominatim fallback.
 * `bias` (lat/lng) nudges Photon toward the trip area when known.
 */
export async function searchPlaces(
  query: string,
  limit = 5,
  bias?: { readonly lat: number; readonly lng: number },
): Promise<readonly GeoPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  // Over-fetch then de-dupe so the user sees `limit` DISTINCT places,
  // not the same city repeated. `lang=en` keeps labels readable.
  const biasQs = bias ? `&lat=${bias.lat}&lon=${bias.lng}` : '';
  const pRes = await timedFetch(
    `${PHOTON}?q=${encodeURIComponent(q)}&limit=${limit * 3}&lang=en${biasQs}`,
    6000,
  );
  if (pRes) {
    try {
      const j = (await pRes.json()) as PhotonResp;
      const seen = new Set<string>();
      const out: GeoPlace[] = [];
      for (const f of j.features ?? []) {
        const lat = f.geometry?.coordinates?.[1] ?? NaN;
        const lng = f.geometry?.coordinates?.[0] ?? NaN;
        const label = photonLabel(f.properties);
        if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        // Dedupe on label + ~100m coord bucket.
        const key = `${label.toLowerCase()}|${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ label, lat, lng });
        if (out.length >= limit) break;
      }
      if (out.length > 0) return out;
    } catch {
      /* fall through to Nominatim */
    }
  }

  const nRes = await timedFetch(
    `${NOMINATIM}?format=json&addressdetails=0&limit=${limit}&q=${encodeURIComponent(q)}`,
    6000,
  );
  if (!nRes) return [];
  try {
    const rows = (await nRes.json()) as NominatimRow[];
    return rows
      .map((r) => ({
        label: r.display_name ?? '',
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      .filter((p) => p.label.length > 0 && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  } catch {
    return [];
  }
}

/** First 2 comma-parts → a concise pin name ("Belém Tower, Lisbon"). */
function shortLabel(full: string): string {
  return full
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
}

/**
 * Reverse-geocode a clicked point → a short human name. Photon first
 * (key-less, CORS-open), Nominatim reverse as fallback. Never throws;
 * a miss returns null so the caller can label it "Custom stop".
 */
/**
 * Reverse-geocode lat/lng to an ISO 3166-1 alpha-2 country code
 * (uppercase, e.g. "IN", "US", "FR"). Photon's `country_code` is
 * uppercase ISO-2 directly; Nominatim's `address.country_code` is
 * lowercase. Returns null on miss / no country / network fail.
 *
 * Added for Phase 2 polish F7 (destination safety section on /home).
 * $0 / no-key / never throws — same ethos as the existing helpers.
 */
export async function reverseGeocodeCountryCode(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const pRes = await timedFetch(`${PHOTON_REVERSE}?lat=${lat}&lon=${lng}&lang=en`, 5000);
  if (pRes) {
    try {
      const j = (await pRes.json()) as {
        readonly features?: ReadonlyArray<{
          readonly properties?: { readonly countrycode?: string };
        }>;
      };
      const cc = j.features?.[0]?.properties?.countrycode;
      if (typeof cc === 'string' && /^[A-Za-z]{2}$/.test(cc)) {
        return cc.toUpperCase();
      }
    } catch {
      /* fall through to Nominatim */
    }
  }
  const nRes = await timedFetch(
    `${NOMINATIM_REVERSE}?format=json&lat=${lat}&lon=${lng}&zoom=3&addressdetails=1`,
    5000,
  );
  if (!nRes) return null;
  try {
    const row = (await nRes.json()) as {
      readonly address?: { readonly country_code?: string };
    };
    const cc = row.address?.country_code;
    if (typeof cc === 'string' && /^[A-Za-z]{2}$/.test(cc)) {
      return cc.toUpperCase();
    }
    return null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const pRes = await timedFetch(`${PHOTON_REVERSE}?lat=${lat}&lon=${lng}&lang=en`, 5000);
  if (pRes) {
    try {
      const j = (await pRes.json()) as PhotonResp;
      const label = photonLabel(j.features?.[0]?.properties);
      if (label) return shortLabel(label);
    } catch {
      /* fall through to Nominatim */
    }
  }
  const nRes = await timedFetch(
    `${NOMINATIM_REVERSE}?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=0`,
    5000,
  );
  if (!nRes) return null;
  try {
    const row = (await nRes.json()) as NominatimRow;
    return row.display_name ? shortLabel(row.display_name) : null;
  } catch {
    return null;
  }
}

/**
 * In-memory geocode cache. Photon hits add ~300ms on Plan submit; on
 * Pulse first message the user already paid that cost — repeated asks
 * to the same place (very common — 'Jaipur', 'Goa', 'Kerala' are typed
 * dozens of times across a session) should be instant.
 *
 * Map keyed by lowercase "place|city". Entries hold {value, at} where
 * `at` is the insertion timestamp; entries older than 1 hour are
 * evicted on next read. Pure session-scoped — clears on reload.
 */
interface CacheEntry {
  readonly value: GeoPlace | null;
  readonly at: number;
}
const GEOCODE_TTL_MS = 60 * 60 * 1000;
const geocodeCache = new Map<string, CacheEntry>();

function cacheKey(place: string, city: string): string {
  return `${place.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
}

/**
 * Resolve ONE place, biased to a city so an itinerary landmark pins
 * near the trip — not a same-named place on another continent.
 * Returns null on miss (caller skips the pin). One network call in
 * the common case (Photon handles "<place> <city>" well). Cached
 * for 1 hour per (place, city) pair.
 */
export async function geocodeOne(
  place: string,
  city: string,
  bias?: { readonly lat: number; readonly lng: number },
): Promise<GeoPlace | null> {
  const q = place.trim();
  if (!q) return null;
  const key = cacheKey(q, city);
  const cached = geocodeCache.get(key);
  if (cached !== undefined) {
    if (Date.now() - cached.at < GEOCODE_TTL_MS) {
      return cached.value;
    }
    geocodeCache.delete(key);
  }
  const hit = await searchPlaces(`${q}, ${city}`, 1, bias);
  const first = hit[0];
  if (first) {
    geocodeCache.set(key, { value: first, at: Date.now() });
    return first;
  }
  const bare = await searchPlaces(q, 1, bias);
  const second = bare[0] ?? null;
  geocodeCache.set(key, { value: second, at: Date.now() });
  return second;
}

/** Test/dev hook — clears the geocode cache. Not exported on the
 *  public surface; reachable via window for manual cache busting. */
if (typeof window !== 'undefined') {
  (window as unknown as { __aetherClearGeocodeCache?: () => void }).__aetherClearGeocodeCache =
    () => geocodeCache.clear();
}
