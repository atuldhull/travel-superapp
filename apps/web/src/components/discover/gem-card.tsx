/**
 * V.UX.19 — hidden-gem card for the hyper-local persona. Renders
 * the place name, category, distance, and a "✨ Hidden gem" pill
 * plus the review count + average so the user can sanity-check
 * the recommendation at a glance.
 *
 * Installed by prompt [V.UX.19]; restyled into the v2 ("Fusion")
 * design language (gold tokens, font-display) alongside /discover.
 */
'use client';

import { Sparkles, Star } from 'lucide-react';
import type { HiddenGemDto } from '@app/sdk';
import { Badge } from '../ui/badge';

interface GemCardProps {
  readonly gem: HiddenGemDto;
}

export function GemCard({ gem }: GemCardProps) {
  return (
    <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold tracking-tight text-surface-foreground">
            {gem.name}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge variant="neutral">{gem.category}</Badge>
            <span aria-hidden>·</span>
            <span>{formatDistance(gem.distanceMeters)}</span>
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-500/12 px-2.5 py-0.5 text-[10px] font-semibold text-gold-700 ring-1 ring-inset ring-gold-500/35 dark:text-gold-300"
          aria-label="Hidden gem"
        >
          <Sparkles aria-hidden className="h-3 w-3" /> Hidden gem
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="rounded-full border border-gold-600/15 bg-surface/60 px-2.5 py-1 text-muted">
          {gem.reviewCount} reviews
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-gold-600/15 bg-gold-500/5 px-2.5 py-1 font-semibold text-surface-foreground">
          <Star aria-hidden className="h-3 w-3 text-gold-500" />
          {gem.reviewAverage.toFixed(1)}
        </span>
      </div>
    </li>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}
