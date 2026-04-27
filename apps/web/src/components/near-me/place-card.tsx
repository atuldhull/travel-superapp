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

interface PlaceCardProps {
  readonly place: NearMePlaceDto;
}

export function PlaceCard({ place }: PlaceCardProps) {
  const walking = place.routes.find((r) => r.mode === 'walk');
  const fastest = place.routes.reduce<NearMeRouteLegDto | undefined>((best, r) => {
    if (!best) return r;
    return r.durationSeconds < best.durationSeconds ? r : best;
  }, undefined);
  return (
    <li className="rounded-md border border-muted/20 bg-surface p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{place.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge variant="neutral">{place.category}</Badge>
            <span>·</span>
            <span>{formatDistance(place.distanceMeters)}</span>
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-muted/10 bg-background px-2 py-1.5">
          <p className="text-muted/70">Walk</p>
          <p className="font-mono">{walking ? formatDuration(walking.durationSeconds) : '—'}</p>
        </div>
        <div className="rounded border border-muted/10 bg-background px-2 py-1.5">
          <p className="text-muted/70">Fastest</p>
          <p className="font-mono">
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
