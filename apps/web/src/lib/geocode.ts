/**
 * Free, key-less place geocoding via the public OSM **Nominatim**
 * service — same $0 / no-key ethos as the OSM map tiles + OSRM
 * routing already used by LiveNavMap. Lets the traveller type ANY
 * "from" / "to" instead of only the presets.
 *
 * Etiquette: Nominatim's public endpoint asks for ≤ 1 req/sec and a
 * real referer (the browser sends Origin/Referer automatically).
 * Callers debounce. For production volume self-host Nominatim or
 * swap in Photon behind this same function — the contract stays.
 *
 * Always resolves (never throws): a failed lookup → empty list, so
 * the UI degrades to "no matches" rather than an error.
 */
export interface GeoPlace {
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

interface NominatimRow {
  readonly display_name?: string;
  readonly lat?: string;
  readonly lon?: string;
}

export async function searchPlaces(query: string, limit = 5): Promise<readonly GeoPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${ENDPOINT}?format=json&addressdetails=0&limit=${limit}&q=${encodeURIComponent(q)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as NominatimRow[];
    return rows
      .map((r) => ({
        label: r.display_name ?? '',
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      .filter((p) => p.label.length > 0 && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
