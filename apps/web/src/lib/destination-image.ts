/**
 * $0, key-less destination photography via the **Wikipedia REST
 * summary** API (`/api/rest_v1/page/summary/<title>`). Famous places
 * have a license-clean lead image on Wikimedia's fast CDN; the
 * endpoint sends `Access-Control-Allow-Origin: *` so the browser can
 * fetch it directly. No account, no key — same ethos as the OSM
 * tiles / OSRM routing already used.
 *
 * Resolution is best-effort: any miss → `null`, and the
 * `<DestinationImage>` component degrades to the royal gradient, so a
 * dead lookup never looks broken (the app's "never show broken"
 * rule). A tiny in-memory cache de-dupes repeat lookups within a
 * session (Wikipedia's CDN handles the rest).
 *
 * `CURATED` maps the app's known preset labels / city names to the
 * best Wikipedia page title (often a landmark, which yields a far
 * more cinematic lead photo than the bare city article).
 */
const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

/** label / city → Wikipedia page title with a strong lead image. */
const CURATED: Readonly<Record<string, string>> = {
  delhi: 'India Gate',
  jaipur: 'Hawa Mahal',
  'delhi → jaipur': 'Hawa Mahal',
  manali: 'Manali',
  leh: 'Leh',
  'manali → leh': 'Leh',
  mumbai: 'Gateway of India',
  pune: 'Shaniwar Wada',
  'mumbai → pune': 'Gateway of India',
  bengaluru: 'Bangalore Palace',
  bangalore: 'Bangalore Palace',
  mysuru: 'Mysore Palace',
  mysore: 'Mysore Palace',
  'bengaluru → mysuru': 'Mysore Palace',
  goa: 'Goa',
  rishikesh: 'Rishikesh',
  agra: 'Taj Mahal',
  'taj mahal': 'Taj Mahal',
  tokyo: 'Tokyo',
  bali: 'Bali',
  lisbon: 'Lisbon',
  'mexico city': 'Mexico City',
  varanasi: 'Varanasi',
  udaipur: 'City Palace, Udaipur',
  kerala: 'Kerala',
  ladakh: 'Pangong Tso',
  spiti: 'Spiti Valley',
};

/** A safe, gorgeous default for the hero / unknown places. */
export const HERO_DEFAULT_PLACE = 'Taj Mahal';

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function pageTitleFor(place: string): string {
  const key = place.trim().toLowerCase();
  if (CURATED[key]) return CURATED[key]!;
  // "City, Region, Country" (geocoder labels) → first segment.
  const head = key.split(',')[0]!.trim();
  if (CURATED[head]) return CURATED[head]!;
  // Title-case the raw place as a last resort (Wikipedia is tolerant).
  return place.trim().split(/\s+/).slice(0, 4).join(' ');
}

/** Resolve a place name to a license-clean lead-image URL, or null. */
export async function destinationImage(place: string): Promise<string | null> {
  if (!place.trim()) return null;
  const title = pageTitleFor(place);
  if (cache.has(title)) return cache.get(title)!;
  const existing = inflight.get(title);
  if (existing) return existing;

  const p = (async (): Promise<string | null> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(`${SUMMARY}${encodeURIComponent(title)}`, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const j = (await res.json()) as {
        readonly originalimage?: { readonly source?: string };
        readonly thumbnail?: { readonly source?: string };
      };
      const url = j.originalimage?.source ?? j.thumbnail?.source ?? null;
      cache.set(title, url);
      return url;
    } catch {
      cache.set(title, null);
      return null;
    } finally {
      clearTimeout(timer);
      inflight.delete(title);
    }
  })();
  inflight.set(title, p);
  return p;
}
