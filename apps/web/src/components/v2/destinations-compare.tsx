/**
 * v2 destination compare — shareable side-by-side of two destination
 * guides via ?a=<slug>&b=<slug>. Two pickers rewrite the URL; the
 * columns show hero, tagline, the normalised facts, the lede, and a
 * plan CTA each. Ports the aether compare capability with no aether dep.
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ALL_SLUGS, DESTINATIONS, type Destination } from '../aether/destinations/data';
import { V2Photo } from './photo';

const DEFAULT_A = 'jaipur';
const DEFAULT_B = 'santorini';
// Union of fact labels across both columns keeps the rows aligned.
const FACT_LABELS = ['Best season', 'Pace', 'Budget'] as const;

const SORTED_SLUGS = [...ALL_SLUGS].sort((a, b) =>
  (DESTINATIONS[a]?.name ?? a).localeCompare(DESTINATIONS[b]?.name ?? b),
);

function factValue(d: Destination, label: string): string {
  return d.facts.find((f) => f.label === label)?.value ?? '—';
}

export function DestinationsCompare(): React.ReactElement {
  const router = useRouter();
  const sp = useSearchParams();
  const aSlug = sp.get('a') ?? DEFAULT_A;
  const bSlug = sp.get('b') ?? DEFAULT_B;
  const a = DESTINATIONS[aSlug];
  const b = DESTINATIONS[bSlug];

  function setSlot(slot: 'a' | 'b', slug: string): void {
    const params = new URLSearchParams(sp.toString());
    params.set(slot, slug);
    router.replace(`/destinations/compare?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {(['a', 'b'] as const).map((slot) => {
          const d = slot === 'a' ? a : b;
          const slug = slot === 'a' ? aSlug : bSlug;
          return (
            <div key={slot} className="space-y-3">
              <label className="block">
                <span className="sr-only">Destination {slot.toUpperCase()}</span>
                <select
                  value={slug}
                  onChange={(e) => setSlot(slot, e.target.value)}
                  aria-label={`Destination ${slot.toUpperCase()}`}
                  className="w-full rounded-xl border border-gold-600/25 bg-surface px-3 py-2 text-sm font-medium text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
                >
                  {SORTED_SLUGS.map((s) => (
                    <option key={s} value={s}>
                      {DESTINATIONS[s]?.name ?? s}
                    </option>
                  ))}
                </select>
              </label>
              {d ? (
                <div className="overflow-hidden rounded-2xl border border-gold-600/12 shadow-(--shadow-depth-1)">
                  <div className="relative">
                    <V2Photo
                      id={d.hero.id}
                      alt={`${d.name}, ${d.state}`}
                      scrim
                      rounded="rounded-none"
                      className="aspect-4/3 w-full"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <span className="inline-flex rounded-full bg-black/35 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                        {d.state}
                      </span>
                      <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {d.name}
                      </h2>
                    </div>
                  </div>
                  <p className="px-4 py-3 text-sm text-muted">{d.tagline}</p>
                </div>
              ) : (
                <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                  Unknown destination.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {a && b ? (
        <>
          {/* Normalised facts table */}
          <div className="overflow-hidden rounded-2xl border border-gold-600/12">
            {FACT_LABELS.map((label, i) => (
              <div key={label} className={i % 2 === 0 ? 'bg-surface' : 'bg-gold-500/[0.04]'}>
                <p className="px-4 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {label}
                </p>
                <div className="grid grid-cols-2 gap-3 px-4 pb-2.5 sm:gap-5">
                  <p className="text-sm font-medium text-surface-foreground">
                    {factValue(a, label)}
                  </p>
                  <p className="text-sm font-medium text-surface-foreground">
                    {factValue(b, label)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Ledes + plan CTAs */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[a, b].map((d) => (
              <div key={d.slug} className="space-y-3">
                <p className="text-sm leading-relaxed text-surface-foreground/85">{d.lede}</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/destinations/${d.slug}` as never}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gold-600/30 px-4 py-2 text-sm font-semibold text-gold-700 transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-gold-300"
                  >
                    Full guide
                  </Link>
                  <Link
                    href={`/trips/new?title=${encodeURIComponent(d.name)}` as never}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
                    style={{ backgroundImage: 'var(--gradient-gold)' }}
                  >
                    <Sparkles aria-hidden className="h-3.5 w-3.5" /> Plan {d.name}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
