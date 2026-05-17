/**
 * PlaceSearch — a debounced, key-less place autocomplete for the
 * Live Navigation custom From/To. Wraps `searchPlaces` (OSM
 * Nominatim, $0). Premium royal styling consistent with /navigate.
 *
 * Controlled-ish: the parent owns the chosen `GeoPlace` via
 * `onSelect`; this component owns the query text + suggestion list.
 * 450 ms debounce keeps within Nominatim's ≤1 req/s etiquette.
 *
 * Installed for the custom-route feature.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { searchPlaces, type GeoPlace } from '../../lib/geocode';

export interface PlaceSearchProps {
  readonly label: string;
  readonly placeholder: string;
  readonly selected: GeoPlace | null;
  readonly onSelect: (place: GeoPlace | null) => void;
}

export function PlaceSearch({ label, placeholder, selected, onSelect }: PlaceSearchProps) {
  const [q, setQ] = useState('');
  const [sug, setSug] = useState<readonly GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounced lookup.
  useEffect(() => {
    if (selected || q.trim().length < 3) {
      setSug([]);
      return;
    }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const r = await searchPlaces(q);
      if (!alive) return;
      setSug(r);
      setOpen(true);
      setBusy(false);
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, selected]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative z-1100">
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      {selected ? (
        <div className="flex items-center gap-2 rounded-xl border border-gold-600/30 bg-gold-500/10 px-3.5 py-2.5 text-sm shadow-(--shadow-depth-1)">
          <MapPin aria-hidden className="h-4 w-4 shrink-0 text-gold-600" />
          <span className="line-clamp-1 flex-1 text-surface-foreground">{selected.label}</span>
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => {
              onSelect(null);
              setQ('');
              setSug([]);
            }}
            className="rounded-full p-1 text-muted transition hover:bg-gold-500/15 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => sug.length > 0 && setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-gold-600/20 bg-surface py-2.5 pl-9 pr-3 text-sm text-surface-foreground outline-none transition placeholder:text-muted/70 focus-visible:border-gold-600/50 focus-visible:ring-2 focus-visible:ring-accent"
          />
          {busy && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">…</span>
          )}
        </div>
      )}
      {open && !selected && sug.length > 0 && (
        <ul className="absolute z-1200 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-gold-600/20 bg-surface p-1 shadow-(--shadow-depth-3)">
          {sug.map((p, i) => (
            <li key={`${p.lat},${p.lng},${i}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm text-surface-foreground transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
                <span className="line-clamp-2">{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
