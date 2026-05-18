/**
 * offline-region — true on-device offline for the vector map.
 *
 * PMTiles serves a map as HTTP **byte-range** reads against one
 * archive. This module slots an IndexedDB cache *underneath* the
 * `pmtiles://` protocol at exactly that seam: every range PMTiles
 * asks for (archive header, directory pages, tile bodies) is
 * write-through cached. "Download this area" then simply *requests*
 * every tile in a bbox once — which warms the byte-range cache — so
 * a later visit with no connection replays those same ranges straight
 * from the device. This is how Organic Maps / Maps.me feel offline,
 * done with the open PMTiles stack and $0 of infrastructure.
 *
 * Honest scope: tiles are cached per device/browser (IndexedDB), not
 * a portable file. The public Protomaps demo bucket is the default
 * source; point `NEXT_PUBLIC_PMTILES_URL` at a self-hosted regional
 * `.pmtiles` for a hard guarantee of full-offline.
 *
 * Installed for the offline-region (download + offline GPS/reroute)
 * feature.
 */
import maplibregl from 'maplibre-gl';
import { FetchSource, PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles';

export const PMTILES_URL =
  process.env['NEXT_PUBLIC_PMTILES_URL'] ?? 'https://demo-bucket.protomaps.com/v4.pmtiles';

/** Be a polite neighbour to the public demo bucket. */
const MAX_TILES = 6000;
const DB_NAME = 'two-oh-offline';
const DB_VERSION = 1;
const STORE_RANGES = 'ranges';
const STORE_META = 'meta';
const META_KEY = 'region';

export interface RegionBBox {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface RegionMeta {
  readonly bbox: RegionBBox;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly tiles: number;
  readonly bytes: number;
  readonly savedAt: number;
}

export interface DownloadProgress {
  readonly done: number;
  readonly total: number;
  readonly bytes: number;
}

export class RegionTooLargeError extends Error {
  constructor(readonly tiles: number) {
    super(`Area too large (${tiles} tiles > ${MAX_TILES}). Zoom in or pick a smaller area.`);
    this.name = 'RegionTooLargeError';
  }
}

// ---------------------------------------------------------------------------
// IndexedDB — a tiny key/blob store. Raw API (no dependency added).
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RANGES)) db.createObjectStore(STORE_RANGES);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const r = tx.objectStore(store).get(key);
        r.onsuccess = () => resolve(r.result as T | undefined);
        r.onerror = () => reject(r.error);
      }),
  );
}

function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbClear(store: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// ---------------------------------------------------------------------------
// The caching Source — the heart of offline. Wraps pmtiles' FetchSource.
// Policy: when the browser is offline, serve from cache first; otherwise
// network-first with write-through, falling back to cache on any failure.
// ---------------------------------------------------------------------------

class IdbCachingSource implements Source {
  private readonly inner: FetchSource;
  private readonly url: string;

  constructor(url: string) {
    this.inner = new FetchSource(url);
    this.url = url;
  }

  getKey(): string {
    return this.inner.getKey();
  }

  private rangeKey(offset: number, length: number): string {
    return `${this.url}|${offset}|${length}`;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    const key = this.rangeKey(offset, length);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

    if (offline) {
      const cached = await idbGet<ArrayBuffer>(STORE_RANGES, key).catch(() => undefined);
      if (cached) return { data: cached };
      // Browser may misreport onLine — fall through and still try the net.
    }

    try {
      const res = await this.inner.getBytes(offset, length, signal, etag);
      // Clone before returning: PMTiles' decompress path can detach the
      // buffer, so the copy we persist must be taken up front.
      void idbPut(STORE_RANGES, key, res.data.slice(0)).catch(() => undefined);
      return res;
    } catch (err) {
      const cached = await idbGet<ArrayBuffer>(STORE_RANGES, key).catch(() => undefined);
      if (cached) return { data: cached };
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Protocol install — idempotent. Replaces the plain pmtiles registration
// so every tile read flows through the IndexedDB cache.
// ---------------------------------------------------------------------------

let installed = false;
let archive: PMTiles | null = null;

export function installOfflinePmtiles(): void {
  if (installed) return;
  const protocol = new Protocol();
  archive = new PMTiles(new IdbCachingSource(PMTILES_URL));
  protocol.add(archive);
  maplibregl.addProtocol('pmtiles', protocol.tile);
  installed = true;
}

// ---------------------------------------------------------------------------
// Tile math (Web Mercator XYZ) + region download.
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1) };
}

interface Tile {
  z: number;
  x: number;
  y: number;
}

function tilesForBbox(bbox: RegionBBox, minZoom: number, maxZoom: number): Tile[] {
  const out: Tile[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const a = lngLatToTile(bbox.west, bbox.north, z);
    const b = lngLatToTile(bbox.east, bbox.south, z);
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
      for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
        out.push({ z, x, y });
      }
    }
  }
  return out;
}

/** Tile count for a bbox/zoom range — for the pre-download estimate. */
export function estimateTileCount(bbox: RegionBBox, minZoom: number, maxZoom: number): number {
  return tilesForBbox(bbox, minZoom, maxZoom).length;
}

export const MAX_REGION_TILES = MAX_TILES;

/**
 * Request every tile in `bbox` once so the IndexedDB byte-range cache
 * is warmed for fully-offline use. Bounded + abortable + never throws
 * for a single missing tile (only for an over-large area).
 */
export async function downloadRegion(
  bbox: RegionBBox,
  minZoom: number,
  maxZoom: number,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<RegionMeta> {
  installOfflinePmtiles();
  const tiles = tilesForBbox(bbox, minZoom, maxZoom);
  if (tiles.length > MAX_TILES) throw new RegionTooLargeError(tiles.length);
  if (!archive) throw new Error('pmtiles not initialised');

  let done = 0;
  let bytes = 0;
  for (const t of tiles) {
    if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');
    try {
      const r = await archive.getZxy(t.z, t.x, t.y, signal ?? undefined);
      if (r) bytes += r.data.byteLength;
    } catch {
      // A single absent/over-zoom tile must not abort the whole region.
    }
    done++;
    if (done % 8 === 0 || done === tiles.length) onProgress?.({ done, total: tiles.length, bytes });
  }

  const meta: RegionMeta = {
    bbox,
    minZoom,
    maxZoom,
    tiles: tiles.length,
    bytes,
    savedAt: Date.now(),
  };
  await idbPut(STORE_META, META_KEY, meta).catch(() => undefined);
  return meta;
}

export function getRegionMeta(): Promise<RegionMeta | undefined> {
  return idbGet<RegionMeta>(STORE_META, META_KEY).catch(() => undefined);
}

export async function clearRegion(): Promise<void> {
  await idbClear(STORE_RANGES).catch(() => undefined);
  await idbClear(STORE_META).catch(() => undefined);
}
