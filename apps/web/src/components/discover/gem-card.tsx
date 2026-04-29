/**
 * V.UX.19 — hidden-gem card for the hyper-local persona. Renders
 * the place name, category, distance, and a "✨ Hidden gem" pill
 * plus the review count + average so the user can sanity-check
 * the recommendation at a glance.
 *
 * Installed by prompt [V.UX.19].
 */
'use client';

import type { HiddenGemDto } from '@app/sdk';
import { Badge } from '../ui/badge';

interface GemCardProps {
  readonly gem: HiddenGemDto;
}

export function GemCard({ gem }: GemCardProps) {
  return (
    <li className="rounded-md border border-muted/20 bg-surface p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{gem.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge variant="neutral">{gem.category}</Badge>
            <span>·</span>
            <span>{formatDistance(gem.distanceMeters)}</span>
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
          aria-label="Hidden gem"
        >
          ✨ Hidden gem
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="rounded border border-muted/10 bg-background px-2 py-1 text-muted">
          {gem.reviewCount} reviews
        </span>
        <span className="rounded border border-muted/10 bg-background px-2 py-1 font-mono">
          ★ {gem.reviewAverage.toFixed(1)}
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
