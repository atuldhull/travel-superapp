/**
 * V.UX.7 compact place card. Optimised for phone-screen + glance:
 * category badge + distance + walking time. No images yet — provider
 * adapters return only metadata; image-fetching lands when the real
 * Google Places adapter ships.
 *
 * Installed by prompt [V.UX.7].
 */
'use client';

import type { NearMePlaceDto, NearMeRouteLegDto } from '@app/sdk';
import { Badge } from '../ui/badge';
import { SafetyBadge } from '../safety/safety-badge';

interface PlaceCardProps {
  readonly place: NearMePlaceDto;
  /**
   * V.UX.13 — area-level safety score (the same `response.safety`
   * the parent already fetches via /near-me). Stamped on every card
   * for the safety-first persona's at-a-glance check.
   */
  readonly safety?: { readonly score: number; readonly grade: string };
}

export function PlaceCard({ place, safety }: PlaceCardProps) {
  const walking = place.routes.find((r) => r.mode === 'walk');
  const fastest = place.routes.reduce<NearMeRouteLegDto | undefined>((best, r) => {
    if (!best) return r;
    return r.durationSeconds < best.durationSeconds ? r : best;
  }, undefined);
  return (
    <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold tracking-tight text-surface-foreground">
            {place.name}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge variant="neutral">{place.category}</Badge>
            <span aria-hidden>·</span>
            <span>{formatDistance(place.distanceMeters)}</span>
            {safety ? (
              <>
                <span aria-hidden>·</span>
                <SafetyBadge score={safety.score} grade={safety.grade} compact />
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-gold-600/12 bg-surface/60 px-2.5 py-1.5">
          <p className="text-muted/70">Walk</p>
          <p className="font-mono text-surface-foreground">
            {walking ? formatDuration(walking.durationSeconds) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-gold-600/12 bg-surface/60 px-2.5 py-1.5">
          <p className="text-muted/70">Fastest</p>
          <p className="font-mono text-surface-foreground">
            {fastest
              ? `${fastest.mode.replace('_', ' ')} · ${formatDuration(fastest.durationSeconds)}`
              : '—'}
          </p>
        </div>
      </div>
    </li>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
