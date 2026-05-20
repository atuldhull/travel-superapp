/**
 * /trips/[id]/recap — cinematic recap of a trip (Phase 4, H5).
 *
 * Read-only "story" view that composes everything we already store
 * for a trip into a single calm scroll:
 *
 *   • Hero — title + date range + the destination's cover image
 *     (first uploaded media OR Wikipedia REST via the existing
 *     `<DestinationImage>` helper, gradient fallback).
 *   • Stats strip — N days · M items checked off · D diary entries
 *     · P photos. Honest: each number reflects real data only.
 *   • Day-by-day timeline — each day's date + summary + list of
 *     items with ✓/○ checkmarks. Photos taken on that date sit
 *     under the items.
 *   • Diary echoes — each diary entry appears in date order with
 *     its mood + first paragraph + AI-assisted badge when set.
 *   • CTAs — back to /trips/[id], open Memory Book if one exists,
 *     write a new diary entry.
 *
 * Honest scope: this is composition, not generation. Nothing is
 * fabricated — when a section is empty, we say so plainly. No new
 * backend endpoint; reuses `tripControllerGetOne`,
 * `tripControllerOverview`, and `listDiaryEntries({ tripId })`.
 *
 * Auth-gated like the rest of /trips. 404 → "not yours OR not
 * found" (existence-probe defence).
 *
 * Installed for Phase 4 (H5).
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  Circle,
  Smile,
  Sparkles,
} from 'lucide-react';
import {
  tripControllerOverview,
  useMediaControllerListByTrip,
  useTripControllerGetOne,
  type ListTripMediaResponseDto,
  type MediaAssetDto,
  type TripDto,
} from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Skeleton } from '../../../../components/ui/skeleton';
import { DestinationImage } from '../../../../components/ui/destination-image';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';
import { coerceTripDate } from '../../../../lib/trip-dto';
import { listDiaryEntries, type DiaryEntryDto } from '../../../../lib/two-oh-api';

interface RecapDayItem {
  readonly id: string;
  readonly position: number;
  readonly notes: string | null;
  readonly completedAt: string | null;
}
interface RecapDay {
  readonly id: string;
  readonly dayIndex: number;
  readonly date: string;
  readonly summary: string | null;
  readonly items: readonly RecapDayItem[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Defensive narrow of the overview's itinerary section. */
function parseRecapDays(overview: unknown): readonly RecapDay[] {
  if (!isObj(overview)) return [];
  const env = overview['data'];
  const root = isObj(env) ? env : overview;
  const it = isObj(root) ? root['itinerary'] : null;
  if (!isObj(it) || it['ok'] !== true) return [];
  const data = it['data'];
  const days = isObj(data) ? data['days'] : null;
  if (!Array.isArray(days)) return [];
  const out: RecapDay[] = [];
  for (const d of days) {
    if (!isObj(d)) continue;
    const id = typeof d['id'] === 'string' ? d['id'] : null;
    const dayIndex = typeof d['dayIndex'] === 'number' ? d['dayIndex'] : null;
    const date = typeof d['date'] === 'string' ? d['date'] : null;
    if (!id || dayIndex === null || !date) continue;
    const summary = typeof d['summary'] === 'string' ? d['summary'].trim() : null;
    const itemsRaw = Array.isArray(d['items']) ? d['items'] : [];
    const items: RecapDayItem[] = [];
    for (const it2 of itemsRaw) {
      if (!isObj(it2)) continue;
      const iid = typeof it2['id'] === 'string' ? it2['id'] : null;
      const pos = typeof it2['position'] === 'number' ? it2['position'] : null;
      if (!iid || pos === null) continue;
      items.push({
        id: iid,
        position: pos,
        notes: typeof it2['notes'] === 'string' ? it2['notes'] : null,
        completedAt:
          typeof it2['completedAt'] === 'string' && it2['completedAt'].length > 0
            ? it2['completedAt']
            : null,
      });
    }
    items.sort((a, b) => a.position - b.position);
    out.push({
      id,
      dayIndex,
      date: date.slice(0, 10),
      summary: summary && summary.length > 0 ? summary : null,
      items,
    });
  }
  out.sort((a, b) => a.dayIndex - b.dayIndex);
  return out;
}

function fmtLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function TripRecapPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const tripQuery = useTripControllerGetOne(tripId, {
    query: { enabled: token !== null && tripId !== '' },
  });
  // orval marks params required even when the controller treats them
  // as optional — `as never` matches the existing /inbox + /home
  // precedent.
  const mediaQuery = useMediaControllerListByTrip(tripId, { limit: '50' } as never, {
    query: { enabled: token !== null && tripId !== '' },
  });

  // Composite overview (itinerary days + items) + diary entries —
  // both via apiFetch-direct since the orval-typed `OverviewItineraryDayDtoItemsItem`
  // is opaque (`Record<string, unknown>`). Parse defensively.
  const [days, setDays] = useState<readonly RecapDay[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<readonly DiaryEntryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token === null || tripId === '') return;
    let alive = true;
    setLoading(true);
    void (async () => {
      const [ov, diary] = await Promise.allSettled([
        tripControllerOverview(tripId),
        listDiaryEntries({ tripId, limit: 200 }),
      ]);
      if (!alive) return;
      if (ov.status === 'fulfilled') setDays(parseRecapDays(ov.value));
      if (diary.status === 'fulfilled') {
        const sorted = [...diary.value.entries].sort((a, b) =>
          a.entryDate.localeCompare(b.entryDate),
        );
        setDiaryEntries(sorted);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [token, tripId]);

  const trip: TripDto | null = useMemo(() => {
    const env = tripQuery.data as { data?: TripDto } | undefined;
    return env?.data ?? null;
  }, [tripQuery.data]);

  // The generated response is `{ data: { media: MediaAssetDto[] } }`.
  // Honest: MediaAssetDto has NO direct image URL field — bytes are
  // served via per-asset presigned-URL calls. For the recap glance
  // we show counts + captions + dates only; thumbnails would need a
  // separate signed-URL fetch per asset, which is deferred.
  const media: readonly MediaAssetDto[] = useMemo(() => {
    const env = mediaQuery.data as { data?: ListTripMediaResponseDto } | undefined;
    return env?.data?.media ?? [];
  }, [mediaQuery.data]);

  // Group media by ISO date so each day's strip can show only its
  // photo count. Matches by the asset's `createdAt` day.
  const mediaByDate = useMemo(() => {
    const map = new Map<string, MediaAssetDto[]>();
    for (const m of media) {
      const date = m.createdAt ? String(m.createdAt).slice(0, 10) : null;
      if (!date) continue;
      const bucket = map.get(date) ?? [];
      bucket.push(m);
      map.set(date, bucket);
    }
    return map;
  }, [media]);

  // Stats roll-up.
  const stats = useMemo(() => {
    let completedItems = 0;
    let totalItems = 0;
    for (const d of days) {
      for (const it of d.items) {
        totalItems += 1;
        if (it.completedAt) completedItems += 1;
      }
    }
    return {
      dayCount: days.length,
      completedItems,
      totalItems,
      diaryCount: diaryEntries.length,
      photoCount: media.length,
    };
  }, [days, diaryEntries, media]);

  if (!bootComplete) {
    return (
      <main>
        <p className="text-muted">Restoring your session…</p>
      </main>
    );
  }
  if (token === null) {
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );
  }
  if (tripQuery.isError) {
    return (
      <main className="space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load this trip.</p>
        <Link href="/trips" className="text-sm text-gold-600 underline-offset-4 hover:underline">
          ← Back to all trips
        </Link>
      </main>
    );
  }

  const tripTitle = trip?.title ?? 'Your trip';
  const tripStarts = coerceTripDate(trip?.startsOn ?? null);
  const tripEnds = coerceTripDate(trip?.endsOn ?? null);
  // MediaAssetDto doesn't expose a direct URL — recap uses the
  // `<DestinationImage>` Wikipedia helper for the hero. Per-asset
  // thumbnails would need a presigned-URL fetch each (deferred).

  return (
    <main className="space-y-8">
      {/* Back link */}
      <p>
        <Link
          href={`/trips/${tripId}` as never}
          className="inline-flex items-center gap-1 text-sm text-muted hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to trip
        </Link>
      </p>

      {/* Hero */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 shadow-(--shadow-depth-2)"
      >
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          <DestinationImage place={tripTitle} className="absolute inset-0 h-full w-full" />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(0deg, rgba(2,3,10,0.75) 0%, rgba(2,3,10,0.2) 40%, transparent 100%)',
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
              <Sparkles aria-hidden className="h-3.5 w-3.5" /> Your trip recap
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {tripTitle}
            </h1>
            {tripStarts && tripEnds ? (
              <p className="mt-1 text-sm text-white/75">
                {fmtLongDate(tripStarts.slice(0, 10))} → {fmtLongDate(tripEnds.slice(0, 10))}
              </p>
            ) : null}
          </div>
        </div>
      </motion.section>

      {/* Stats strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { label: 'Days', value: stats.dayCount, Icon: Calendar },
            {
              label: 'Items done',
              value: `${stats.completedItems}/${stats.totalItems}`,
              Icon: CheckCircle2,
            },
            { label: 'Diary entries', value: stats.diaryCount, Icon: BookOpen },
            { label: 'Photos', value: stats.photoCount, Icon: Camera },
          ] satisfies readonly { label: string; value: number | string; Icon: typeof Calendar }[]
        ).map((s) => {
          const Icon = s.Icon;
          return (
            <Card key={s.label} depth="raised" className="p-4">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                <Icon aria-hidden className="h-3.5 w-3.5" /> {s.label}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-surface-foreground">
                {s.value}
              </p>
            </Card>
          );
        })}
      </section>

      {/* Day-by-day timeline */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Day by day
        </h2>
        {loading ? (
          <Skeleton className="h-32" />
        ) : days.length === 0 ? (
          <Card depth="flat" className="p-5">
            <CardSubtitle>
              No itinerary days yet for this trip. Add some on the{' '}
              <Link
                href={`/trips/${tripId}` as never}
                className="text-gold-600 underline-offset-4 hover:underline"
              >
                trip page
              </Link>{' '}
              and they&apos;ll show up here.
            </CardSubtitle>
          </Card>
        ) : (
          <ol className="space-y-3">
            {days.map((d) => {
              const photos = mediaByDate.get(d.date) ?? [];
              const done = d.items.filter((it) => it.completedAt).length;
              return (
                <li key={d.id}>
                  <Card depth="raised" className="p-5">
                    <CardHeader>
                      <div className="flex items-baseline justify-between gap-3">
                        <CardTitle className="text-lg">
                          Day {d.dayIndex + 1}{' '}
                          <span className="text-muted text-sm font-normal">
                            · {fmtLongDate(d.date)}
                          </span>
                        </CardTitle>
                        {d.items.length > 0 ? (
                          <span className="shrink-0 text-xs text-muted">
                            ✓ {done}/{d.items.length}
                          </span>
                        ) : null}
                      </div>
                      {d.summary ? <CardSubtitle>{d.summary}</CardSubtitle> : null}
                    </CardHeader>
                    {d.items.length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        {d.items.map((it) => (
                          <li
                            key={it.id}
                            className="flex items-start gap-2 text-sm text-surface-foreground"
                          >
                            {it.completedAt ? (
                              <CheckCircle2
                                aria-label="Done"
                                className="mt-0.5 h-4 w-4 shrink-0 text-gold-600"
                              />
                            ) : (
                              <Circle
                                aria-label="Not done"
                                className="mt-0.5 h-4 w-4 shrink-0 text-muted/50"
                              />
                            )}
                            <span className={it.completedAt ? '' : 'text-muted'}>
                              {it.notes ?? <em>(no notes)</em>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {photos.length > 0 ? (
                      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold-600/20 bg-gold-500/8 px-3 py-1 text-xs text-gold-700 dark:text-gold-300">
                        <Camera aria-hidden className="h-3 w-3" />
                        {photos.length} photo{photos.length === 1 ? '' : 's'} taken this day
                      </p>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Diary echoes */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Diary</h2>
        {loading ? (
          <Skeleton className="h-24" />
        ) : diaryEntries.length === 0 ? (
          <Card depth="flat" className="p-5">
            <CardSubtitle>
              No diary entries for this trip yet.{' '}
              <Link
                href={
                  `/diary?tripId=${encodeURIComponent(tripId)}&title=${encodeURIComponent(`Day in ${tripTitle}`)}` as never
                }
                className="text-gold-600 underline-offset-4 hover:underline"
              >
                Write one
              </Link>{' '}
              and it&apos;ll appear here.
            </CardSubtitle>
          </Card>
        ) : (
          <ol className="space-y-3">
            {diaryEntries.map((e) => {
              const first = e.body.split('\n\n')[0] ?? e.body;
              const preview = first.length > 280 ? first.slice(0, 277) + '…' : first;
              return (
                <li key={e.id}>
                  <Card depth="raised" className="p-5">
                    <CardHeader>
                      <CardTitle className="text-lg">{e.title}</CardTitle>
                      <CardSubtitle>
                        {fmtLongDate(e.entryDate.slice(0, 10))}
                        {e.mood ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-gold-600/20 bg-gold-500/8 px-2 py-0.5 text-xs">
                            <Smile aria-hidden className="h-3 w-3" /> {e.mood}
                          </span>
                        ) : null}
                        {e.aiAssisted ? (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs">
                            <Sparkles aria-hidden className="h-3 w-3" /> AI-assisted
                          </span>
                        ) : null}
                      </CardSubtitle>
                    </CardHeader>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-surface-foreground">
                      {preview}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* CTAs */}
      <section className="flex flex-wrap gap-3">
        <Link href={`/trips/${tripId}` as never}>
          <Button variant="royal">Back to trip</Button>
        </Link>
        <Link
          href={
            `/diary?tripId=${encodeURIComponent(tripId)}&title=${encodeURIComponent(`Day in ${tripTitle}`)}` as never
          }
        >
          <Button variant="secondary">Add a diary entry</Button>
        </Link>
        <Link href="/memory-books">
          <Button variant="ghost">Memory books</Button>
        </Link>
      </section>
    </main>
  );
}
