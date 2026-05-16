/**
 * Trip detail page — `/trips/:id`. Shows the single trip the caller
 * owns; lets them rename / re-radius / re-date inline + delete with a
 * confirmation gate. Itinerary + overview composite render lands in a
 * follow-up slice.
 *
 * Auth-gated identically to /trips: silent-refresh boot completes
 * first, then bounce to /login if no token. 404 from the api means
 * "not yours OR not found" (existence-probe defence) — surface the
 * same diagnostic either way.
 *
 * Installed by prompt [IV.18.19.29]. Plan-with-AI section added by
 * [IV.18.19.45].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getTripControllerGetItineraryQueryKey,
  getTripControllerGetOneQueryKey,
  getTripControllerListQueryKey,
  useMediaControllerListByTrip,
  useTripControllerBuildItinerary,
  useTripControllerDuplicate,
  useTripControllerLock,
  useTripControllerUnlock,
  useTripControllerGetItinerary,
  useTripControllerGetOne,
  useTripControllerPlanWithAi,
  useTripControllerRemove,
  useTripControllerShare,
  useTripControllerUpdate,
  useTripControllerUpdateDay,
  type CreateTripShareRequestDto,
  type GeneratePlanWithAiResponseDto,
  type ItineraryDayDto,
  type ItineraryListResponseDto,
  type ListTripMediaResponseDto,
  type MediaAssetDto,
  type TripDto,
  type TripShareResponseDto,
  type UpdateDayItemDto,
  type UpdateDayItemsRequestDto,
  type UpdateTripRequestDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { AgentWatchCard } from '../../../components/agent/agent-watch-card';
import { MediaUploader } from '../../../components/media-uploader';
import { ExportPdfButton } from '../../../components/trip/export-pdf-button';
import { EmailItineraryButton } from '../../../components/trip/email-itinerary-button';
import { OpenOnMobileButton } from '../../../components/trip/open-on-mobile-button';
import { DailySpendBanner } from '../../../components/budget/daily-spend-banner';
import { AudioReadout } from '../../../components/trip/audio-readout';
import { PacingWarning } from '../../../components/trip/pacing-warning';
import { DayFestivalBanner, useFestivalsByDate } from '../../../components/trip/festival-overlay';
import { AdventureWindow } from '../../../components/weather/adventure-window';
import { PlaceSuggestionPicker } from '../../../components/trip/place-suggestion-picker';
import { PowerPlannerSection } from '../../../components/trip/power-planner-section';
import { ShareList } from '../../../components/trip/share-list';
import { VoteButtons } from '../../../components/trip/vote-buttons';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useTripControllerGetOne(id, {
    query: { enabled: token !== null && id !== '' },
  });

  const updateMutation = useTripControllerUpdate({
    mutation: {
      onSuccess: async (_response: unknown) => {
        await queryClient.invalidateQueries({ queryKey: getTripControllerGetOneQueryKey(id) });
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' } as never),
        });
        setEditing(false);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Update failed.'}`);
      },
    },
  });

  const lockMutation = useTripControllerLock({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getTripControllerGetOneQueryKey(id) });
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' } as never),
        });
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Lock failed.'}`);
      },
    },
  });

  const unlockMutation = useTripControllerUnlock({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getTripControllerGetOneQueryKey(id) });
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' } as never),
        });
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Unlock failed.'}`);
      },
    },
  });

  const duplicateMutation = useTripControllerDuplicate({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        const newTrip = response.data as TripDto;
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' } as never),
        });
        router.push(`/trips/${newTrip.id}`);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Duplicate failed.'}`,
        );
      },
    },
  });

  const deleteMutation = useTripControllerRemove({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' } as never),
        });
        router.push('/trips');
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Delete failed.'}`);
      },
    },
  });

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
  if (isLoading) {
    return (
      <main className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </main>
    );
  }
  if (isError) {
    const e = error as ApiError;
    return (
      <main className="space-y-4">
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load trip ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
        </p>
        <p>
          <Link href="/trips" className="text-sm text-muted hover:underline">
            ← Back to trips
          </Link>
        </p>
      </main>
    );
  }

  const trip = data?.data as unknown as TripDto & {
    role?: 'owner' | 'collaborator';
    ownerDisplayName?: string | null;
  };
  const role: 'owner' | 'collaborator' = trip?.role ?? 'owner';
  const isCollaborator = role === 'collaborator';

  return (
    <main className="space-y-6">
      <p>
        <Link href="/trips" className="text-sm text-muted hover:underline">
          ← Back to trips
        </Link>
      </p>
      {/* POST.2A.5 — renders null unless NEXT_PUBLIC_FEATURE_AGENT_ENABLED=true */}
      <AgentWatchCard tripId={id} />
      {isCollaborator ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          👥 Collaborator on{' '}
          <strong>
            {trip.ownerDisplayName ? `${trip.ownerDisplayName}'s trip` : "someone else's trip"}
          </strong>
          . You can vote and add expenses, but only the owner can edit or delete.
        </p>
      ) : null}
      {editing && !isCollaborator ? (
        <EditForm
          trip={trip}
          onCancel={() => {
            setEditing(false);
            setErrorMsg(null);
          }}
          onSubmit={(patch) => updateMutation.mutate({ id, data: patch })}
          isPending={updateMutation.isPending}
          errorMsg={errorMsg}
        />
      ) : (
        <ReadView
          trip={trip}
          role={role}
          onEdit={() => {
            setEditing(true);
            setErrorMsg(null);
          }}
          onAskDelete={() => {
            setConfirmDelete(true);
            setErrorMsg(null);
          }}
          onDuplicate={() => {
            setErrorMsg(null);
            duplicateMutation.mutate({ id });
          }}
          isDuplicating={duplicateMutation.isPending}
          duplicateErrorMsg={errorMsg}
          onLockToggle={() => {
            setErrorMsg(null);
            if (trip.status === 'published') {
              unlockMutation.mutate({ id });
            } else {
              lockMutation.mutate({ id });
            }
          }}
          isLockToggling={lockMutation.isPending || unlockMutation.isPending}
        />
      )}
      <DailySpendBanner tripId={id} enabled={token !== null && !editing} />
      <PacingWarning tripId={id} enabled={token !== null && !editing} />
      <AdventureWindow />
      <ItinerarySection tripId={id} enabled={token !== null && !editing} />
      <PowerPlannerSection tripId={id} enabled={token !== null && !editing} />
      <PlaceSuggestionPicker tripId={id} enabled={token !== null && !editing} />
      <ShareList tripId={id} enabled={token !== null && !editing} />
      <PlanWithAiSection tripId={id} enabled={token !== null && !editing} />
      <MediaSection tripId={id} enabled={token !== null && !editing} />
      <ShareSection tripId={id} enabled={token !== null && !editing} />
      {confirmDelete ? (
        <Card>
          <CardHeader>
            <CardTitle>Delete this trip?</CardTitle>
            <CardSubtitle>
              This cascades to itinerary days, items, and shares. The action cannot be undone.
            </CardSubtitle>
          </CardHeader>
          {errorMsg ? (
            <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => deleteMutation.mutate({ id })}
              disabled={deleteMutation.isPending}
              className="bg-danger text-white hover:opacity-90"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmDelete(false);
                setErrorMsg(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
    </main>
  );
}

interface ReadViewProps {
  readonly trip: TripDto;
  readonly role: 'owner' | 'collaborator';
  readonly onEdit: () => void;
  readonly onAskDelete: () => void;
  readonly onDuplicate: () => void;
  readonly isDuplicating: boolean;
  readonly duplicateErrorMsg: string | null;
  readonly onLockToggle: () => void;
  readonly isLockToggling: boolean;
}

function ReadView({
  trip,
  role,
  onEdit,
  onAskDelete,
  onDuplicate,
  isDuplicating,
  duplicateErrorMsg,
  onLockToggle,
  isLockToggling,
}: ReadViewProps) {
  const isOwner = role === 'owner';
  const statusVariant: 'neutral' | 'brand' = trip.status === 'draft' ? 'neutral' : 'brand';
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{trip.title}</CardTitle>
            <CardSubtitle>
              <Badge variant={statusVariant}>{trip.status}</Badge> · Radius {trip.radiusKm}km · v
              {trip.version}
            </CardSubtitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/trips/${trip.id}/overview` as never}
              className="inline-flex items-center gap-1 rounded-md border border-brand/30 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/5"
            >
              Overview
            </Link>
            <Link
              href={`/trips/${trip.id}/expenses` as never}
              className="inline-flex items-center gap-1 rounded-md border border-brand/30 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/5"
            >
              Expenses
            </Link>
            <OpenOnMobileButton tripId={trip.id} />
            <ExportPdfButton tripId={trip.id} tripTitle={trip.title} />
            <EmailItineraryButton tripId={trip.id} tripTitle={trip.title} />
            <AudioReadout tripId={trip.id} tripTitle={trip.title} enabled={true} />
            {/* V.UX.17 — premium concierge entry. Visible to everyone;
                the destination page itself wraps content in
                <PremiumGate> so non-premium callers see the upgrade
                CTA on click. */}
            <Link
              href={`/trips/${trip.id}/concierge` as never}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
            >
              ✨ Concierge
            </Link>
            {/* V.UX.18 — pre-trip primer (visa, scams, emergency,
                phrases). Editorial seed; auth-gated. */}
            <Link
              href={`/trips/${trip.id}/primer` as never}
              className="inline-flex items-center gap-1 rounded-md border border-brand/30 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/5"
            >
              🌐 Primer
            </Link>
            {isOwner ? (
              <>
                <Button variant="outline" size="sm" onClick={onDuplicate} disabled={isDuplicating}>
                  {isDuplicating ? 'Duplicating…' : 'Duplicate'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLockToggle}
                  disabled={isLockToggling}
                >
                  {isLockToggling
                    ? trip.status === 'published'
                      ? 'Unlocking…'
                      : 'Locking…'
                    : trip.status === 'published'
                      ? '🔓 Unlock'
                      : '🔒 Lock'}
                </Button>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={onAskDelete}>
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        </div>
        {trip.status === 'published' ? (
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            🔒 <strong>Locked.</strong> Share collaborators can read + vote + log expenses, but only
            you can edit the itinerary or trip metadata. Unlock to reopen edits.
          </p>
        ) : null}
        {duplicateErrorMsg ? (
          <p className="mt-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {duplicateErrorMsg}
          </p>
        ) : null}
      </CardHeader>
      <p className="text-sm text-muted">
        {trip.startsOn && trip.endsOn ? (
          <>
            {new Date(trip.startsOn as unknown as string).toLocaleDateString()} →{' '}
            {new Date(trip.endsOn as unknown as string).toLocaleDateString()}
          </>
        ) : (
          'No dates yet'
        )}
      </p>
      <p className="mt-2 text-xs text-muted">
        Created {new Date(trip.createdAt).toLocaleString()} · Updated{' '}
        {new Date(trip.updatedAt).toLocaleString()}
      </p>
    </Card>
  );
}

interface EditFormProps {
  readonly trip: TripDto;
  readonly onSubmit: (patch: UpdateTripRequestDto) => void;
  readonly onCancel: () => void;
  readonly isPending: boolean;
  readonly errorMsg: string | null;
}

function EditForm({ trip, onSubmit, onCancel, isPending, errorMsg }: EditFormProps) {
  const [title, setTitle] = useState(trip.title);
  const [radiusKm, setRadiusKm] = useState(String(trip.radiusKm));
  const [startsOn, setStartsOn] = useState(
    trip.startsOn ? (trip.startsOn as unknown as string).slice(0, 10) : '',
  );
  const [endsOn, setEndsOn] = useState(
    trip.endsOn ? (trip.endsOn as unknown as string).slice(0, 10) : '',
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const patch: UpdateTripRequestDto = {};
    if (title !== trip.title) patch.title = title;
    const r = Number(radiusKm);
    if (Number.isFinite(r) && r !== trip.radiusKm) patch.radiusKm = r;
    const oldStarts = trip.startsOn ? (trip.startsOn as unknown as string).slice(0, 10) : '';
    const oldEnds = trip.endsOn ? (trip.endsOn as unknown as string).slice(0, 10) : '';
    // Orval emits nullable date-time fields as `{[key:string]:unknown}|null`
    // (its understanding of nullable+format is limited). Cast through unknown.
    if (startsOn !== oldStarts) {
      patch.startsOn = (startsOn
        ? new Date(startsOn).toISOString()
        : null) as unknown as UpdateTripRequestDto['startsOn'];
    }
    if (endsOn !== oldEnds) {
      patch.endsOn = (endsOn
        ? new Date(endsOn).toISOString()
        : null) as unknown as UpdateTripRequestDto['endsOn'];
    }
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    onSubmit(patch);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit trip</CardTitle>
      </CardHeader>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Field
          label="Radius (km)"
          type="number"
          step="any"
          min={1}
          max={500}
          value={radiusKm}
          onChange={(e) => setRadiusKm(e.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Starts on"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            help="Empty clears."
          />
          <Field
            label="Ends on"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            help="≥ starts on."
          />
        </div>
        {errorMsg ? (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
            {errorMsg}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface ItinerarySectionProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

function ItinerarySection({ tripId, enabled }: ItinerarySectionProps) {
  const queryClient = useQueryClient();
  const [genErr, setGenErr] = useState<string | null>(null);
  const { data, isLoading, isError } = useTripControllerGetItinerary(tripId, {
    query: { enabled },
  });

  const buildMutation = useTripControllerBuildItinerary({
    mutation: {
      onSuccess: async () => {
        setGenErr(null);
        await queryClient.invalidateQueries({
          queryKey: getTripControllerGetItineraryQueryKey(tripId),
        });
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setGenErr(
          e.code === 'TRIP_DATES_REQUIRED'
            ? 'Set startsOn + endsOn first (Edit the trip to add dates).'
            : `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Generate failed.'}`,
        );
      },
    },
  });

  if (!enabled) return null;

  const body = data?.data as unknown as ItineraryListResponseDto | undefined;
  const days: readonly ItineraryDayDto[] = body?.days ?? [];

  // V.UX.22 — fetch festivals once for the trip's date span and
  // pass the resolved per-day map down so DayRow can stamp a "🎉
  // X today" banner without re-querying per row.
  const fromIso =
    days.length > 0 ? new Date(days[0]!.date as unknown as string).toISOString() : null;
  const toIso =
    days.length > 0
      ? new Date(
          new Date(days[days.length - 1]!.date as unknown as string).getTime() + 86_400_000,
        ).toISOString()
      : null;
  const { festivalsByDate } = useFestivalsByDate({ fromIso, toIso });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Itinerary</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{days.length} days</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={buildMutation.isPending}
              onClick={() => buildMutation.mutate({ id: tripId })}
            >
              {buildMutation.isPending
                ? 'Generating…'
                : days.length === 0
                  ? 'Generate'
                  : 'Regenerate'}
            </Button>
          </div>
        </div>
      </CardHeader>
      {genErr ? (
        <p className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {genErr}
        </p>
      ) : null}
      {isLoading ? (
        <Skeleton className="h-4 w-2/3" count={3} />
      ) : isError ? (
        <p className="text-sm text-danger">Couldn't load itinerary.</p>
      ) : days.length === 0 ? (
        <p className="text-sm text-muted">
          No itinerary yet. Click <strong>Generate</strong> to create one day per date in the trip's
          range. Requires startsOn + endsOn on the trip.
        </p>
      ) : (
        <ol className="space-y-3">
          {days.map((d) => (
            <DayRow key={d.id} day={d} tripId={tripId} festivalsByDate={festivalsByDate} />
          ))}
        </ol>
      )}
    </Card>
  );
}

function DayRow({
  day,
  tripId,
  festivalsByDate,
}: {
  day: ItineraryDayDto;
  tripId: string;
  festivalsByDate: ReadonlyMap<string, ReadonlyArray<{ readonly title: string }>>;
}) {
  const [editing, setEditing] = useState(false);
  const dateStr = new Date(day.date as unknown as string).toLocaleDateString();
  return (
    <li className="rounded border border-muted/15 p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <strong className="text-sm">Day {day.dayIndex + 1}</strong>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted">{dateStr}</span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-brand hover:underline"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>
      {day.summary ? (
        <p className="text-xs text-muted">{day.summary as unknown as string}</p>
      ) : null}
      <DayFestivalBanner
        dayDate={day.date as unknown as string}
        festivalsByDate={
          festivalsByDate as ReadonlyMap<
            string,
            readonly {
              externalId: string;
              title: string;
              venueName: string | null;
              startsAt: string;
              endsAt: string;
            }[]
          >
        }
      />
      {editing ? (
        <DayItemsEditor day={day} onClose={() => setEditing(false)} />
      ) : day.items.length === 0 ? (
        <p className="text-xs text-muted/70">No items.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-xs text-muted">
          {day.items.map((it) => {
            const notes = it.notes as unknown as string | null;
            const placeId = it.placeId as unknown as string | null;
            return (
              <li key={it.id} className="flex items-start justify-between gap-2 py-1">
                <span className="flex-1">
                  · {notes ?? <em>(no notes)</em>}
                  {placeId ? (
                    <span className="ml-1 opacity-70">({placeId.slice(0, 8)}…)</span>
                  ) : null}
                </span>
                <VoteButtons tripId={tripId} targetId={it.id} targetType="itinerary_item" />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

interface DayItemsEditorProps {
  readonly day: ItineraryDayDto;
  readonly onClose: () => void;
}

interface DraftItem {
  readonly key: string;
  notes: string;
  placeId: string;
}

function DayItemsEditor({ day, onClose }: DayItemsEditorProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<DraftItem[]>(() =>
    day.items.map((it) => ({
      key: `existing-${it.id}`,
      notes: ((it.notes as unknown as string | null) ?? '').trim(),
      placeId: ((it.placeId as unknown as string | null) ?? '').trim(),
    })),
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const saveMutation = useTripControllerUpdateDay({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getTripControllerGetItineraryQueryKey(day.tripId),
        });
        onClose();
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Save failed.'}`);
      },
    },
  });

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${prev.length}`, notes: '', placeId: '' },
    ]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap]!, next[idx]!];
      return next;
    });
  }
  function patchItem(idx: number, patch: Partial<Pick<DraftItem, 'notes' | 'placeId'>>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function save() {
    setErrMsg(null);
    // Orval emits nullable string fields on the request body as
    // `{[key: string]: unknown} | null`. Cast through unknown so the
    // call site stays readable.
    const payload = items.map((it, i) => ({
      position: i + 1,
      ...(it.placeId.trim() ? { placeId: it.placeId.trim() } : {}),
      ...(it.notes.trim() ? { notes: it.notes.trim() } : {}),
    })) as unknown as UpdateDayItemDto[];
    const data: UpdateDayItemsRequestDto = { items: payload };
    saveMutation.mutate({ tripId: day.tripId, dayId: day.id, data });
  }

  return (
    <div className="mt-2 space-y-2">
      {items.length === 0 ? (
        <p className="text-xs text-muted/70">No items. Add one with the button below.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, idx) => (
            <li
              key={it.key}
              className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded border border-muted/15 p-2 text-xs"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-muted hover:text-brand disabled:opacity-30"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="text-muted hover:text-brand disabled:opacity-30"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <input
                type="text"
                value={it.notes}
                onChange={(e) => patchItem(idx, { notes: e.target.value })}
                placeholder="Notes (optional)"
                maxLength={500}
                className="rounded border border-muted/30 bg-surface px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={it.placeId}
                onChange={(e) => patchItem(idx, { placeId: e.target.value })}
                placeholder="Place id (optional)"
                className="rounded border border-muted/30 bg-surface px-2 py-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-xs text-danger hover:underline"
                aria-label="Remove item"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {errMsg ? (
        <p className="rounded border border-danger/30 bg-danger/5 px-2 py-1 text-xs text-danger">
          {errMsg}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          + Add item
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface MediaSectionProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

function MediaSection({ tripId, enabled }: MediaSectionProps) {
  const { data, isLoading, isError } = useMediaControllerListByTrip(
    tripId,
    { limit: '50' },
    { query: { enabled } },
  );

  if (!enabled) return null;

  const body = data?.data as unknown as ListTripMediaResponseDto | undefined;
  const assets: readonly MediaAssetDto[] = body?.media ?? [];
  const ready = assets.filter((a) => a.status === 'ready');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Media</CardTitle>
          <Badge variant="neutral">
            {ready.length} {ready.length === 1 ? 'asset' : 'assets'}
          </Badge>
        </div>
      </CardHeader>
      {isLoading ? (
        <Skeleton className="h-4 w-2/3" count={2} />
      ) : isError ? (
        <p className="text-sm text-danger">Couldn't load media.</p>
      ) : ready.length === 0 ? (
        <p className="text-sm text-muted">No media attached yet. Use the uploader below.</p>
      ) : (
        <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ready.map((a) => (
            <MediaTile key={a.id} asset={a} />
          ))}
        </ul>
      )}
      <MediaUploader tripId={tripId} />
    </Card>
  );
}

function MediaTile({ asset }: { asset: MediaAssetDto }) {
  const dateStr = new Date(asset.createdAt).toLocaleDateString();
  const isVideo = asset.kind === 'video';
  return (
    <li className="flex flex-col rounded border border-muted/15 bg-muted/5 p-2 text-xs">
      <div className="flex aspect-square items-center justify-center rounded bg-muted/20 text-2xl">
        {isVideo ? '🎬' : '🖼️'}
      </div>
      <p className="mt-1 truncate font-mono text-[10px] text-muted">{asset.id.slice(0, 8)}…</p>
      <p className="text-[10px] text-muted">{dateStr}</p>
    </li>
  );
}

interface PlanWithAiSectionProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

function PlanWithAiSection({ tripId, enabled }: PlanWithAiSectionProps) {
  const [plan, setPlan] = useState<GeneratePlanWithAiResponseDto | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const planMutation = useTripControllerPlanWithAi({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as GeneratePlanWithAiResponseDto;
        setPlan(body);
        setErrMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(
          e.code === 'TRIP_NOT_FOUND'
            ? 'Trip not found, or its center coordinates are missing. Set a center on /trips/new before asking for a plan.'
            : `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Plan failed.'}`,
        );
      },
    },
  });

  if (!enabled) return null;

  // POST.4 — show a friendly "powered by …" label per provider tier.
  const providerLabel: Record<string, string> = {
    anthropic: 'Powered by Claude',
    gemini: 'Powered by Gemini',
    ollama: 'Powered by Ollama (local)',
    stub: 'Built-in planner',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>AI plan</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={planMutation.isPending}
            onClick={() => planMutation.mutate({ id: tripId })}
          >
            {planMutation.isPending ? 'Thinking…' : plan ? 'Re-plan' : 'Generate plan'}
          </Button>
        </div>
        <CardSubtitle>
          Free-form prose suggestions. Picks the best available LLM at boot (Anthropic → Gemini →
          Ollama → built-in stub).
        </CardSubtitle>
      </CardHeader>
      {errMsg ? (
        <p className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errMsg}
        </p>
      ) : null}
      {planMutation.isPending && !plan ? (
        <div aria-busy="true" aria-label="Generating plan" className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-muted/20" />
          <div className="space-y-2 rounded border border-muted/15 bg-muted/5 px-3 py-3">
            <div className="h-3 w-full animate-pulse rounded bg-muted/20" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-muted/20" />
            <div className="h-3 w-9/12 animate-pulse rounded bg-muted/20" />
            <div className="h-3 w-10/12 animate-pulse rounded bg-muted/20" />
          </div>
        </div>
      ) : plan ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">{providerLabel[plan.provider] ?? plan.provider}</Badge>
            <span className="text-[10px] text-muted">{plan.model}</span>
            {plan.tokenUsage ? (
              <span
                className="text-[10px] text-muted"
                title={`input ${plan.tokenUsage.inputTokens} · output ${plan.tokenUsage.outputTokens}${plan.tokenUsage.cachedTokens ? ` · cached ${plan.tokenUsage.cachedTokens}` : ''}`}
              >
                · {plan.tokenUsage.inputTokens + plan.tokenUsage.outputTokens} tokens
              </span>
            ) : null}
          </div>
          <pre className="whitespace-pre-wrap rounded border border-muted/15 bg-muted/5 px-3 py-2 font-sans text-sm leading-relaxed">
            {plan.plan}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Click <strong>Generate plan</strong> for a quick prose itinerary based on this trip's
          title, radius, and dates.
        </p>
      )}
    </Card>
  );
}

interface ShareSectionProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

function ShareSection({ tripId, enabled }: ShareSectionProps) {
  const [share, setShare] = useState<TripShareResponseDto | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mintMutation = useTripControllerShare({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as TripShareResponseDto;
        setShare(body);
        setErrMsg(null);
        setCopied(false);
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Mint failed.'}`);
      },
    },
  });

  if (!enabled) return null;

  function shareUrl(code: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    return `${apiBase}/api/v1/trips/shared/${code}`;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrMsg('Clipboard write blocked by the browser.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Share</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={mintMutation.isPending}
            onClick={() => {
              const data: CreateTripShareRequestDto = {};
              mintMutation.mutate({ id: tripId, data });
            }}
          >
            {mintMutation.isPending ? 'Minting…' : share ? 'New code' : 'Mint code'}
          </Button>
        </div>
        <CardSubtitle>
          A share code grants public read of this trip via <code>GET /trips/shared/:code</code>.
        </CardSubtitle>
      </CardHeader>
      {errMsg ? (
        <p className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errMsg}
        </p>
      ) : null}
      {share ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted/10 px-2 py-1 font-mono text-xs">
              {share.shareCode}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(shareUrl(share.shareCode))}
            >
              {copied ? 'Copied!' : 'Copy URL'}
            </Button>
          </div>
          <p className="text-xs text-muted">
            URL:{' '}
            <code className="break-all font-mono text-[10px]">{shareUrl(share.shareCode)}</code>
          </p>
          {share.expiresAt ? (
            <p className="text-xs text-muted">
              Expires: {new Date(share.expiresAt as unknown as string).toLocaleString()}
            </p>
          ) : (
            <p className="text-xs text-muted">No expiry.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Click <strong>Mint code</strong> to create a public read link.
        </p>
      )}
    </Card>
  );
}
