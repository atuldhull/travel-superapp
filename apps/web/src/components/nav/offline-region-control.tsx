/**
 * OfflineRegionControl — the "⬇ Download this area" panel on the
 * vector map. Warms the IndexedDB tile cache for the current viewport
 * so the area renders, locates (device GPS), and reroutes with zero
 * connectivity. Honest copy about what offline does and doesn't cover.
 *
 * Self-contained: owns its phase/progress; the parent only supplies a
 * `getBBox()` reading the live map viewport.
 *
 * Installed for the offline-region feature.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2, Trash2, WifiOff, X } from 'lucide-react';
import {
  clearRegion,
  downloadRegion,
  estimateTileCount,
  getRegionMeta,
  MAX_REGION_TILES,
  type DownloadProgress,
  type RegionBBox,
  type RegionMeta,
} from '../../lib/offline-region';
import { cn } from '../../lib/cn';

// Detail tiers, most-detailed first. The first tier that fits under
// the polite tile cap for the chosen area wins (roads appear ~z12+,
// so every tier keeps enough zoom for offline rerouting).
const TIERS: ReadonlyArray<{ minZoom: number; maxZoom: number }> = [
  { minZoom: 8, maxZoom: 15 },
  { minZoom: 8, maxZoom: 14 },
  { minZoom: 7, maxZoom: 13 },
];

function pickTier(bbox: RegionBBox): { minZoom: number; maxZoom: number; tiles: number } | null {
  for (const t of TIERS) {
    const tiles = estimateTileCount(bbox, t.minZoom, t.maxZoom);
    if (tiles <= MAX_REGION_TILES) return { ...t, tiles };
  }
  return null;
}

function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}

type Phase = 'idle' | 'downloading' | 'done' | 'error';

export interface OfflineRegionControlProps {
  readonly getBBox: () => RegionBBox | null;
  readonly className?: string;
}

export function OfflineRegionControl({ getBBox, className }: OfflineRegionControlProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [meta, setMeta] = useState<RegionMeta | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    getRegionMeta().then((m) => {
      if (!alive) return;
      if (m) {
        setMeta(m);
        setPhase('done');
      }
    });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  async function start(): Promise<void> {
    const bbox = getBBox();
    if (!bbox) {
      setError('Move or zoom the map, then try again.');
      setPhase('error');
      return;
    }
    const tier = pickTier(bbox);
    if (!tier) {
      setError('This area is too large. Zoom in to a city or district and retry.');
      setPhase('error');
      return;
    }
    setError(null);
    setProgress({ done: 0, total: tier.tiles, bytes: 0 });
    setPhase('downloading');
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const m = await downloadRegion(
        bbox,
        tier.minZoom,
        tier.maxZoom,
        (p) => setProgress(p),
        ac.signal,
      );
      setMeta(m);
      setPhase('done');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setPhase(meta ? 'done' : 'idle');
        return;
      }
      setError(e instanceof Error ? e.message : 'Download failed. Check your connection.');
      setPhase('error');
    } finally {
      abortRef.current = null;
    }
  }

  async function wipe(): Promise<void> {
    await clearRegion();
    setMeta(null);
    setProgress(null);
    setPhase('idle');
  }

  const pct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className={cn('w-64 max-w-[78vw]', className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-gold-500/40 bg-black/55 px-3 py-1.5 text-xs font-medium text-gold-200 backdrop-blur-sm transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {phase === 'done' ? (
            <>
              <Check aria-hidden className="h-3.5 w-3.5 text-green-400" />
              Offline area ready
            </>
          ) : phase === 'downloading' ? (
            <>
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
              Downloading {pct}%
            </>
          ) : (
            <>
              <Download aria-hidden className="h-3.5 w-3.5" />
              Download this area
            </>
          )}
        </button>
      ) : (
        <div className="rounded-2xl border border-gold-600/25 bg-black/70 p-3.5 text-xs text-gold-100 shadow-(--shadow-depth-3) backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-gold-200">
              <WifiOff aria-hidden className="h-3.5 w-3.5" />
              Offline area
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-muted transition hover:text-gold-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>

          {phase === 'downloading' && progress ? (
            <div className="space-y-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gold-500 transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-gold-200/80">
                {progress.done}/{progress.total} tiles · {mb(progress.bytes)}
              </p>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="w-full rounded-lg border border-gold-600/30 px-3 py-1.5 font-medium text-gold-100 transition hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          ) : phase === 'done' && meta ? (
            <div className="space-y-2.5">
              <p className="flex items-center gap-1.5 text-green-300">
                <Check aria-hidden className="h-3.5 w-3.5" />
                Ready · {meta.tiles} tiles · {mb(meta.bytes)}
              </p>
              <p className="leading-relaxed text-gold-200/70">
                This area now renders, locates, and reroutes without a connection. Live position
                uses your <strong>device GPS</strong> (works without signal on GPS-capable
                hardware). Leave the road and a corrected route is computed on-device — OSM
                geometry, bounded to this area (no turn restrictions or live traffic).
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={start}
                  className="flex-1 rounded-lg border border-gold-600/30 px-3 py-1.5 font-medium text-gold-100 transition hover:bg-white/5"
                >
                  Re-download
                </button>
                <button
                  type="button"
                  onClick={wipe}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 font-medium text-red-300 transition hover:bg-red-500/10"
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="leading-relaxed text-gold-200/70">
                Caches the map you see now to this device so it works with zero signal — including
                live GPS position and on-device rerouting if you take a wrong turn.
              </p>
              {phase === 'error' && error ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-red-300">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                onClick={start}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gold-500/40 bg-gold-500/15 px-3 py-2 font-semibold text-gold-100 transition hover:bg-gold-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Download aria-hidden className="h-4 w-4" />
                Download this area
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
