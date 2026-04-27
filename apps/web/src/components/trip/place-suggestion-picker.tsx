/**
 * V.UX.4 weekend-traveler picker. "Suggest places" button hits
 * `POST /trips/:id/place-suggestions`, renders up to 6 cards in a
 * 2-column grid, lets the user multi-select, pick a target itinerary
 * day, and bulk-add the chosen places as items on that day.
 *
 * Design notes:
 *   - Sample copy: "Based on your trip, here are 6 must-do places —
 *     pick 4". The "pick 4" hint isn't enforced; it's a nudge so users
 *     don't blindly check all 6 and overload Day 1.
 *   - Add-to-day appends after the day's existing items via
 *     `useTripControllerUpdateDay` (which replaces the entire item
 *     list — we merge client-side).
 *   - `enabled` mirrors the other trip-detail subsections so the
 *     suggestion request doesn't fire while the trip is being edited.
 *
 * Installed by prompt [V.UX.4].
 */
'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getTripControllerGetItineraryQueryKey,
  useTripControllerGetItinerary,
  useTripControllerPlaceSuggestions,
  useTripControllerUpdateDay,
  type ItineraryDayDto,
  type ItineraryListResponseDto,
  type SuggestedPlaceDto,
  type SuggestPlacesForTripResponseDto,
  type UpdateDayItemDto,
  type UpdateDayItemsRequestDto,
} from '@app/sdk';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../ui/card';

interface PlaceSuggestionPickerProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export function PlaceSuggestionPicker({ tripId, enabled }: PlaceSuggestionPickerProps) {
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<readonly SuggestedPlaceDto[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [targetDayId, setTargetDayId] = useState<string>('');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);

  const { data: itineraryData } = useTripControllerGetItinerary(tripId, { query: { enabled } });
  const itineraryBody = itineraryData?.data as unknown as ItineraryListResponseDto | undefined;
  const days: readonly ItineraryDayDto[] = itineraryBody?.days ?? [];

  const suggestMutation = useTripControllerPlaceSuggestions({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as SuggestPlacesForTripResponseDto;
        setSuggestions(body.suggestions);
        setSelected(new Set());
        setAddedCount(null);
        setErrMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Suggest failed.'}`);
      },
    },
  });

  const addMutation = useTripControllerUpdateDay({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getTripControllerGetItineraryQueryKey(tripId),
        });
        setAddedCount(selected.size);
        setSelected(new Set());
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Add to itinerary failed.'}`,
        );
      },
    },
  });

  function toggle(placeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }

  function addToDay() {
    setErrMsg(null);
    if (selected.size === 0) {
      setErrMsg('Pick at least one place first.');
      return;
    }
    const day = days.find((d) => d.id === targetDayId);
    if (!day) {
      setErrMsg('Pick a day to add to (Generate the itinerary first if there are no days yet).');
      return;
    }
    const existing: UpdateDayItemDto[] = day.items.map((it, idx) => ({
      position: idx + 1,
      ...(it.placeId ? { placeId: it.placeId as unknown as string } : {}),
      ...(it.notes ? { notes: it.notes as unknown as string } : {}),
    })) as unknown as UpdateDayItemDto[];
    const additions: UpdateDayItemDto[] = suggestions
      .filter((s) => selected.has(s.placeId))
      .map((s, i) => ({
        position: existing.length + i + 1,
        placeId: s.placeId,
        notes: s.name,
      })) as unknown as UpdateDayItemDto[];
    const data: UpdateDayItemsRequestDto = { items: [...existing, ...additions] };
    addMutation.mutate({ tripId, dayId: day.id, data });
  }

  if (!enabled) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Suggest places</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={suggestMutation.isPending}
            onClick={() => suggestMutation.mutate({ id: tripId, data: {} })}
          >
            {suggestMutation.isPending
              ? 'Searching…'
              : suggestions.length === 0
                ? 'Get suggestions'
                : 'Refresh'}
          </Button>
        </div>
        <CardSubtitle>
          AI-curated picks near your trip's center. Pick a few, drop them into a day.
        </CardSubtitle>
      </CardHeader>

      {errMsg ? (
        <p className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errMsg}
        </p>
      ) : null}

      {suggestions.length === 0 ? (
        <p className="text-sm text-muted">
          Click <strong>Get suggestions</strong> for a hand-picked shortlist (up to 6) you can drop
          into your itinerary in one click.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            Based on your trip, here are {suggestions.length} must-do places — pick 4.
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestions.map((s) => {
              const checked = selected.has(s.placeId);
              return (
                <li key={s.placeId}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${
                      checked
                        ? 'border-brand bg-brand/5'
                        : 'border-muted/20 hover:border-muted/40 hover:bg-muted/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.placeId)}
                      className="mt-0.5 h-4 w-4 accent-brand"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted">
                        <Badge variant="neutral">{s.category}</Badge>{' '}
                        <span className="ml-1">{formatDistance(s.distanceMeters)}</span>
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs text-muted">
              <span className="mb-1 font-medium">Add to day</span>
              <select
                value={targetDayId}
                onChange={(e) => setTargetDayId(e.target.value)}
                className="rounded border border-muted/30 bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">— pick a day —</option>
                {days.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    Day {i + 1} — {new Date(d.date as unknown as string).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              onClick={addToDay}
              disabled={
                addMutation.isPending ||
                selected.size === 0 ||
                targetDayId === '' ||
                days.length === 0
              }
            >
              {addMutation.isPending ? 'Adding…' : `Add ${selected.size || ''} to itinerary`}
            </Button>
            {addedCount !== null && addedCount > 0 ? (
              <span className="text-xs text-emerald-600">
                ✓ Added {addedCount} place{addedCount === 1 ? '' : 's'}.
              </span>
            ) : null}
          </div>
          {days.length === 0 ? (
            <p className="mt-2 text-xs text-muted/70">
              No itinerary days yet. Generate an itinerary above first.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.round(meters)} m away`;
  return `${(meters / 1_000).toFixed(1)} km away`;
}
