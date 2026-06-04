/**
 * v2 destinations catalog — the browsable guide built on the app's
 * curated destination data (the same dataset the landing + AI planner
 * use). India + world, filterable by region with a live search. Each
 * card opens the long-form /destinations/[slug] guide.
 *
 * This re-surfaces the editorial destination content (hero, facts,
 * lede, moments, itineraries) as a first-class feature in the new web
 * — no aether dependency, pure v2 tokens.
 */
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GitCompareArrows, Search } from 'lucide-react';
import { DESTINATIONS, INTERNATIONAL_SLUGS } from '../aether/destinations/data';
import { V2Photo } from './photo';
import { cn } from '../../lib/cn';

const INTL = new Set(INTERNATIONAL_SLUGS);
const ALL = Object.values(DESTINATIONS);

type Region = 'all' | 'india' | 'world';
const REGIONS: ReadonlyArray<{ key: Region; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'india', label: 'India' },
  { key: 'world', label: 'World' },
];

export function DestinationsCatalog(): React.ReactElement {
  const [region, setRegion] = useState<Region>('all');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL.filter((d) => {
      const isIntl = INTL.has(d.slug);
      if (region === 'india' && isIntl) return false;
      if (region === 'world' && !isIntl) return false;
      if (q && !`${d.name} ${d.state} ${d.tagline}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [region, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by region">
          {REGIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRegion(r.key)}
              aria-pressed={region === r.key}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                region === r.key
                  ? 'bg-gold-500/15 text-gold-700 ring-1 ring-inset ring-gold-500/35 dark:text-gold-300'
                  : 'text-muted hover:bg-gold-500/10 hover:text-surface-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/destinations/compare"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold-600/25 px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-gold-500/10 hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <GitCompareArrows aria-hidden className="h-4 w-4 text-gold-600" /> Compare
          </Link>
          <label className="flex flex-1 items-center gap-2 rounded-full border border-gold-600/25 bg-surface px-3.5 py-2 transition focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-500/25 sm:w-64 sm:flex-none">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-gold-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search destinations…"
              aria-label="Search destinations"
              className="w-full bg-transparent text-sm text-surface-foreground outline-none placeholder:text-muted/70"
            />
          </label>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-gold-600/15 bg-surface px-6 py-10 text-center text-sm text-muted shadow-(--shadow-depth-1)">
          No destinations match “{query}”. Try a different search or region.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {items.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/destinations/${d.slug}` as never}
                className="group relative block overflow-hidden rounded-2xl border border-gold-600/12 shadow-(--shadow-depth-2) transition duration-300 hover:-translate-y-1 hover:shadow-(--shadow-depth-3) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <V2Photo
                  id={d.hero.id}
                  alt={`${d.name}, ${d.state}`}
                  scrim
                  rounded="rounded-2xl"
                  className="aspect-4/5 w-full transition duration-700 group-hover:scale-105"
                />
                <span className="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {d.state}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-2xl font-semibold text-white">{d.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-white/75">{d.tagline}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
