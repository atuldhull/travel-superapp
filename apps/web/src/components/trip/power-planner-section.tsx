/**
 * V.UX.6 power-planner section. Orchestrates the multi-day drag-
 * and-drop editor + per-day route map + Optimize-day button + per-
 * item notes save-on-blur.
 *
 * Mounted on `/trips/[id]` alongside the simpler ItinerarySection
 * (V.UX.4-era). The two coexist intentionally: power-planner adds
 * affordances without removing the inline form, so users can
 * fall back to typed editing if drag-drop is awkward.
 *
 * State model:
 *   - `daysOrder[dayId] = string[]` — the local item-id order per day,
 *     mirroring server state. Drag operations mutate this immediately
 *     so the UI feels instant; the matching `useTripControllerUpdateDay`
 *     mutation persists on drag end.
 *   - Notes use save-on-blur (in `DayItemDragList`); the parent
 *     pipes the change through the same updateDay mutation.
 *
 * Map:
 *   - One `RouteMap` per day, fed by `useTripControllerDayRouteCoords`
 *     for that day's items. Local reorder also reorders the map's
 *     stops array — no extra round trip needed for drag-preview.
 *
 * Installed by prompt [V.UX.6].
 */
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  getTripControllerDayRouteCoordsQueryKey,
  getTripControllerGetItineraryQueryKey,
  useTripControllerDayRouteCoords,
  useTripControllerGetItinerary,
  useTripControllerOptimizeDay,
  useTripControllerUpdateDay,
  type DayRouteCoordsResponseDto,
  type ItineraryDayDto,
  type ItineraryListResponseDto,
  type OptimizeDayRouteResponseDto,
  type UpdateDayItemDto,
  type UpdateDayItemsRequestDto,
} from '@app/sdk';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../ui/card';
import { DayItemDragList, type DragItem } from './day-item-drag-list';
import type { RouteStop } from './route-map';

// RouteMap touches `window` (Leaflet) — keep it out of the prerender pass.
const RouteMap = dynamic(() => import('./route-map').then((m) => m.RouteMap), {
  ssr: false,
  loading: () => (
    <div className="h-56 w-full animate-pulse rounded-md border border-muted/30 bg-muted/10" />
  ),
});

interface PowerPlannerSectionProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

interface OptimizeMessage {
  readonly dayId: string;
  readonly beforeSeconds: number;
  readonly afterSeconds: number;
  readonly skippedCount: number;
}

export function PowerPlannerSection({ tripId, enabled }: PowerPlannerSectionProps) {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const { data } = useTripControllerGetItinerary(tripId, { query: { enabled } });
  const body = data?.data as unknown as ItineraryListResponseDto | undefined;
  const days: readonly ItineraryDayDto[] = useMemo(() => body?.days ?? [], [body]);

  // Local mirror of the per-day item order. Lets drag operations feel
  // instant; the mutation reconciles with the server.
  const [order, setOrder] = useState<Record<string, string[]>>({});
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [optMsg, setOptMsg] = useState<OptimizeMessage | null>(null);

  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const d of days) next[d.id] = d.items.map((it) => it.id);
    setOrder(next);
  }, [days]);

  const updateMutation = useTripControllerUpdateDay({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getTripControllerGetItineraryQueryKey(tripId),
        });
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Save failed.'}`);
      },
    },
  });

  const optimizeMutation = useTripControllerOptimizeDay({
    mutation: {
      onSuccess: async (response: { data?: unknown }, variables: { dayId: string }) => {
        const r = response.data as OptimizeDayRouteResponseDto;
        setOptMsg({
          dayId: variables.dayId,
          beforeSeconds: r.beforeSeconds,
          afterSeconds: r.afterSeconds,
          skippedCount: r.skippedCount,
        });
        await queryClient.invalidateQueries({
          queryKey: getTripControllerGetItineraryQueryKey(tripId),
        });
        await queryClient.invalidateQueries({
          queryKey: getTripControllerDayRouteCoordsQueryKey(tripId, variables.dayId),
        });
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Optimize failed.'}`);
      },
    },
  });

  if (!enabled) return null;
  if (days.length === 0) return null;

  function persistDay(dayId: string, itemIds: readonly string[]) {
    // Map back from local id order to UpdateDayItemDto[] using the
    // server-side metadata (placeId + notes) for each id.
    const allItems = days.flatMap((d) => d.items.map((it) => ({ ...it, parentDayId: d.id })));
    const lookup = new Map(allItems.map((it) => [it.id, it]));
    const items: UpdateDayItemDto[] = itemIds
      .map((id, idx) => {
        const it = lookup.get(id);
        if (!it) return null;
        return {
          position: idx + 1,
          ...(it.placeId ? { placeId: it.placeId as unknown as string } : {}),
          ...(it.notes ? { notes: it.notes as unknown as string } : {}),
        } as UpdateDayItemDto;
      })
      .filter((x): x is UpdateDayItemDto => x !== null);
    const payload: UpdateDayItemsRequestDto = { items };
    updateMutation.mutate({ tripId, dayId, data: payload });
  }

  function handleDragEnd(event: DragEndEvent) {
    setErrMsg(null);
    const { active, over } = event;
    if (!over) return;
    const fromDay = (active.data.current as { dayId?: string } | undefined)?.dayId;
    const overData = over.data.current as { dayId?: string; kind?: string } | undefined;
    const toDay = overData?.dayId;
    if (!fromDay || !toDay) return;
    if (active.id === over.id) return;

    setOrder((prev) => {
      const next = { ...prev };
      const fromList = [...(next[fromDay] ?? [])];
      const fromIdx = fromList.indexOf(active.id as string);
      if (fromIdx < 0) return prev;
      fromList.splice(fromIdx, 1);

      if (fromDay === toDay) {
        // Intra-day reorder: figure out target index from the item being
        // dropped onto. If dropping onto the day container itself,
        // append.
        if (overData?.kind === 'item') {
          const toIdx = fromList.indexOf(over.id as string);
          fromList.splice(toIdx >= 0 ? toIdx : fromList.length, 0, active.id as string);
        } else {
          fromList.push(active.id as string);
        }
        next[fromDay] = fromList;
      } else {
        // Cross-day move: delete from source, insert in destination.
        const toList = [...(next[toDay] ?? [])];
        if (overData?.kind === 'item') {
          const toIdx = toList.indexOf(over.id as string);
          toList.splice(toIdx >= 0 ? toIdx : toList.length, 0, active.id as string);
        } else {
          toList.push(active.id as string);
        }
        next[fromDay] = fromList;
        next[toDay] = toList;
      }

      // Persist both affected days. Same mutation, sequential is fine —
      // updateDay is idempotent + small.
      persistDay(fromDay, next[fromDay]!);
      if (fromDay !== toDay) persistDay(toDay, next[toDay]!);
      return next;
    });
  }

  function reorderItem(params: {
    dayId: string;
    itemId: string;
    direction: 'up' | 'down' | 'top' | 'bottom';
  }) {
    setErrMsg(null);
    setOrder((prev) => {
      const next = { ...prev };
      const list = [...(next[params.dayId] ?? [])];
      const idx = list.indexOf(params.itemId);
      if (idx < 0) return prev;
      let target = idx;
      if (params.direction === 'up') target = Math.max(0, idx - 1);
      else if (params.direction === 'down') target = Math.min(list.length - 1, idx + 1);
      else if (params.direction === 'top') target = 0;
      else target = list.length - 1;
      if (target === idx) return prev;
      list.splice(idx, 1);
      list.splice(target, 0, params.itemId);
      next[params.dayId] = list;
      persistDay(params.dayId, list);
      return next;
    });
  }

  function saveNotes(params: { dayId: string; itemId: string; notes: string }) {
    setErrMsg(null);
    const ids = order[params.dayId] ?? [];
    const items: UpdateDayItemDto[] = ids
      .map((id, idx) => {
        const day = days.find((d) => d.id === params.dayId);
        const it = day?.items.find((x) => x.id === id);
        if (!it) return null;
        const isTarget = id === params.itemId;
        const noteText = isTarget
          ? params.notes
          : ((it.notes as unknown as string | null) ?? '').trim();
        return {
          position: idx + 1,
          ...(it.placeId ? { placeId: it.placeId as unknown as string } : {}),
          ...(noteText ? { notes: noteText } : {}),
        } as UpdateDayItemDto;
      })
      .filter((x): x is UpdateDayItemDto => x !== null);
    updateMutation.mutate({ tripId, dayId: params.dayId, data: { items } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Power planner</CardTitle>
        <CardSubtitle>
          Drag items between days, edit notes inline, and let the optimiser shuffle a day for the
          shortest travel.
        </CardSubtitle>
      </CardHeader>
      {errMsg ? (
        <p className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {errMsg}
        </p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <ol className="space-y-4">
          {days.map((d) => {
            const ids = order[d.id] ?? d.items.map((it) => it.id);
            const itemsInOrder: DragItem[] = ids
              .map((id) => {
                const it = d.items.find((x) => x.id === id);
                if (!it) return null;
                return {
                  id: it.id,
                  placeId: (it.placeId as unknown as string | null) ?? null,
                  notes: (it.notes as unknown as string | null) ?? null,
                };
              })
              .filter((x): x is DragItem => x !== null);
            return (
              <DayPanel
                key={d.id}
                tripId={tripId}
                day={d}
                items={itemsInOrder}
                localItemIds={ids}
                onNotesBlur={saveNotes}
                onItemReorder={reorderItem}
                onOptimize={() => optimizeMutation.mutate({ tripId, dayId: d.id })}
                isOptimizing={
                  optimizeMutation.isPending && optimizeMutation.variables?.dayId === d.id
                }
                optMsg={optMsg && optMsg.dayId === d.id ? optMsg : null}
              />
            );
          })}
        </ol>
      </DndContext>
    </Card>
  );
}

interface DayPanelProps {
  readonly tripId: string;
  readonly day: ItineraryDayDto;
  readonly items: readonly DragItem[];
  readonly localItemIds: readonly string[];
  readonly onNotesBlur: (params: { dayId: string; itemId: string; notes: string }) => void;
  readonly onItemReorder: (params: {
    dayId: string;
    itemId: string;
    direction: 'up' | 'down' | 'top' | 'bottom';
  }) => void;
  readonly onOptimize: () => void;
  readonly isOptimizing: boolean;
  readonly optMsg: OptimizeMessage | null;
}

function DayPanel({
  tripId,
  day,
  items,
  localItemIds,
  onNotesBlur,
  onItemReorder,
  onOptimize,
  isOptimizing,
  optMsg,
}: DayPanelProps) {
  const dateStr = new Date(day.date as unknown as string).toLocaleDateString();
  const { data } = useTripControllerDayRouteCoords(tripId, day.id);
  const coordsBody = data?.data as unknown as DayRouteCoordsResponseDto | undefined;
  const coordsByItem = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number; placeId: string }>();
    for (const c of coordsBody?.coords ?? []) {
      m.set(c.itemId, { lat: c.lat, lng: c.lng, placeId: c.placeId });
    }
    return m;
  }, [coordsBody]);

  // Re-order map stops to match the local drag order so the polyline
  // updates instantly.
  const stops: RouteStop[] = localItemIds
    .map((id): RouteStop | null => {
      const c = coordsByItem.get(id);
      if (!c) return null;
      return { id, lat: c.lat, lng: c.lng, label: c.placeId };
    })
    .filter((x): x is RouteStop => x !== null);

  return (
    <li className="rounded border border-muted/15 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <strong className="text-sm">
          Day {day.dayIndex + 1} <Badge variant="neutral">{dateStr}</Badge>
        </strong>
        <Button variant="outline" size="sm" onClick={onOptimize} disabled={isOptimizing}>
          {isOptimizing ? 'Optimising…' : '✨ Optimise'}
        </Button>
      </div>
      {optMsg ? (
        <p className="mb-2 rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          {optMsg.beforeSeconds === 0 ? (
            <>Nothing to optimise yet.</>
          ) : (
            <>
              Travel time: <strong>{formatSeconds(optMsg.beforeSeconds)}</strong> →{' '}
              <strong>{formatSeconds(optMsg.afterSeconds)}</strong> (saved{' '}
              <strong>{formatSeconds(optMsg.beforeSeconds - optMsg.afterSeconds)}</strong>)
              {optMsg.skippedCount > 0 ? ` · ${optMsg.skippedCount} item(s) skipped` : ''}
            </>
          )}
        </p>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-[1fr_minmax(0,360px)]">
        <DayItemDragList
          dayId={day.id}
          items={items}
          onItemNotesBlur={onNotesBlur}
          onItemReorder={onItemReorder}
        />
        <RouteMap stops={stops} className="h-56 w-full" />
      </div>
    </li>
  );
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
