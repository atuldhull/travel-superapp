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
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

interface PhotonResp {
  readonly features?: ReadonlyArray<{
    readonly geometry?: { readonly coordinates?: readonly [number, number] };
    readonly properties?: {
      readonly name?: string;
      readonly city?: string;
      readonly state?: string;
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

function photonLabel(p: NonNullable<PhotonResp['features']>[number]['properties']): string {
  if (!p) return '';
  return [p.name, p.city, p.state, p.country].filter(Boolean).join(', ');
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

  const biasQs = bias ? `&lat=${bias.lat}&lon=${bias.lng}` : '';
  const pRes = await timedFetch(
    `${PHOTON}?q=${encodeURIComponent(q)}&limit=${limit}${biasQs}`,
    6000,
  );
  if (pRes) {
    try {
      const j = (await pRes.json()) as PhotonResp;
      const out = (j.features ?? [])
        .map((f) => ({
          label: photonLabel(f.properties),
          lat: f.geometry?.coordinates?.[1] ?? NaN,
          lng: f.geometry?.coordinates?.[0] ?? NaN,
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
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

/**
 * Resolve ONE place, biased to a city so an itinerary landmark pins
 * near the trip — not a same-named place on another continent.
 * Returns null on miss (caller skips the pin). One network call in
 * the common case (Photon handles "<place> <city>" well).
 */
export async function geocodeOne(
  place: string,
  city: string,
  bias?: { readonly lat: number; readonly lng: number },
): Promise<GeoPlace | null> {
  const q = place.trim();
  if (!q) return null;
  const hit = await searchPlaces(`${q}, ${city}`, 1, bias);
  if (hit[0]) return hit[0];
  const bare = await searchPlaces(q, 1, bias);
  return bare[0] ?? null;
}
