/**
 * `useTripCenter(tripId)` — fetch the PostGIS trip center via the
 * Phase-2-polish F2 route `GET /api/v1/trips/:id/center`.
 *
 * Lifted out of `home/page.tsx` (Phase 2 polish F9) so any surface
 * that wants to seed the global assistant with `{ title, center }`
 * reads from a single helper. apiFetch-direct (no SDK regen — same
 * documented seam as the rest of the 2.0 surfaces).
 *
 * Honest scope: a fetch failure or invalid coords → null. The caller
 * decides what to render in that state (typically: hide the
 * context-aware button, never break the page).
 */
'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@app/sdk';

export interface TripCenter {
  readonly lat: number;
  readonly lng: number;
}

export function useTripCenter(tripId: string | null | undefined): TripCenter | null {
  const [center, setCenter] = useState<TripCenter | null>(null);

  useEffect(() => {
    if (!tripId) {
      setCenter(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await apiFetch<{
          data: { lat: number; lng: number };
          status: number;
          headers: Headers;
        }>(`/api/v1/trips/${tripId}/center`, { method: 'GET' });
        if (!alive) return;
        const d = res.data;
        if (
          d &&
          typeof d.lat === 'number' &&
          Number.isFinite(d.lat) &&
          typeof d.lng === 'number' &&
          Number.isFinite(d.lng)
        ) {
          setCenter({ lat: d.lat, lng: d.lng });
        } else {
          setCenter(null);
        }
      } catch {
        if (alive) setCenter(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tripId]);

  return center;
}
