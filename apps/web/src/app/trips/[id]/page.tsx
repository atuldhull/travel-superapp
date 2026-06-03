/**
 * Trip detail page — `/trips/:id`.
 *
 * Owner-readable / collaborator-readable view of a single trip,
 * roughly organised as:
 *
 *   ReadView (header)
 *     ↳ title + status badge + radius + version
 *     ↳ Navigate · Write diary · ✨ Plan with AI (F9 — opens the
 *       global assistant pre-seeded with this trip's center via
 *       `useTripCenter`) · Overview · Expenses · Open on mobile ·
 *       Export PDF · Email itinerary · Audio readout · Concierge
 *     ↳ Live spend banner, pacing warning, festival overlay,
 *       adventure window
 *   EditForm (inline)
 *     ↳ rename / re-radius / re-date / delete behind a confirm gate
 *   PowerPlannerSection
 *     ↳ V.UX.6 nearest-neighbour day reorder
 *   ItineraryList + DayCard + DayItemsEditor
 *     ↳ G1: per-item completion checkbox (`ItemCheckbox`) — taps
 *       hit POST /trips/items/:itemId/(un)complete via apiFetch.
 *   AgentWatchCard (POST-2.0): pending replan proposals / signals
 *   ShareList + MediaUploader
 *
 * Auth-gated identically to /trips: silent-refresh boot completes
 * first, then bounce to /login if no token. 404 from the api means
 * "not yours OR not found" (existence-probe defence) — surface the
 * same diagnostic either way.
 *
 * Cross-cutting: TripDto date fields read via the shared
 * `coerceTripDate` helper (F4 / F17 — no `as unknown as string`
 * casts on the read side; the two remaining write-side casts are
 * documented orval-limitation territory).
 *
 * Installed by prompt [IV.18.19.29]. Extended through F9 / F17 / G1.
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  tripControllerShiftItinerary,
  getTripControllerGetItineraryQueryKey,
  getTripControllerGetOneQueryKey,
  getTripControllerListQueryKey,
  useMediaControllerListByTrip,
  useTripControllerArchive,
  useTripControllerBuildItinerary,
  useTripControllerDuplicate,
  useTripControllerLock,
  useTripControllerUnarchive,
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
import { ItemCheckbox } from '../../../components/trip/item-checkbox';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { useTripCenter } from '../../../lib/use-trip-center';
import { coerceTripDate } from '../../../lib/trip-dto';
import { openAssistantWith } from '../../../components/assistant/global-assistant';
import { PublishPanel } from '../../../components/trip/publish-panel';
import { TripComments } from '../../../components/trip/trip-comments';
import { TripBuddies } from '../../../components/trip/trip-buddies';

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

  // [S-C1] V.UX.30 archive surface — soft-deletes the trip from the
  // owner's list (still queryable by direct id; not in /trips). Owner-
  // gated server-side; idempotent. The CONFIRM gate prevents
  // mis-clicks since unarchive can't reach an irrecoverable trip.
  const [confirmArchive, setConfirmArchive] = useState(false);

  const archiveMutation = useTripControllerArchive({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getTripControllerGetOneQueryKey(id) });
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' } as never),
        });
        setConfirmArchive(false);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Archive failed.'}`);
      },
    },
  });

  const unarchiveMutation = useTripControllerUnarchive({
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
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Unarchive failed.'}`,
        );
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
        <p className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
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
          onAskArchive={() => {
            setConfirmArchive(true);
            setErrorMsg(null);
          }}
          onUnarchive={() => {
            setErrorMsg(null);
            unarchiveMutation.mutate({ id });
          }}
          isUnarchiving={unarchiveMutation.isPending}
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
      {/* J5 — travel-buddy matchmaking. Owner-only (the API matches
          buddies for your own trip); self-hides when there are none. */}
      {token !== null && !editing && role === 'owner' ? <TripBuddies tripId={id} /> : null}
      {/* J4 — comment thread. Self-contained; the API gates posting
          to published trips and explains when the trip isn't yet. */}
      {token !== null && !editing ? <TripComments tripId={id} /> : null}
      {confirmArchive ? (
        <Card>
          <CardHeader>
            <CardTitle>Archive this trip?</CardTitle>
            <CardSubtitle>
              The trip is hidden from your list but kept intact. Unarchive any time from the trip
              page (you'll need the direct URL).
            </CardSubtitle>
          </CardHeader>
          {errorMsg ? (
            <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => archiveMutation.mutate({ id })}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmArchive(false);
                setErrorMsg(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
      {confirmDelete ? (
        <Card>
          <CardHeader>
            <CardTitle>Delete this trip?</CardTitle>
            <CardSubtitle>
              This cascades to itinerary days, items, and shares. The action cannot be undone.
            </CardSubtitle>
          </CardHeader>
          {errorMsg ? (
            <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => deleteMutation.mutate({ id })}
              disabled={deleteMutation.isPending}
              className="bg-red-600 text-white hover:opacity-90"
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
  readonly onAskArchive: () => void;
  readonly onUnarchive: () => void;
  readonly isUnarchiving: boolean;
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
  onAskArchive,
  onUnarchive,
  isUnarchiving,
}: ReadViewProps) {
  const isOwner = role === 'owner';
  const isArchived = trip.archivedAt != null;
  const statusVariant: 'neutral' | 'brand' = trip.status === 'draft' ? 'neutral' : 'brand';
  // F9 — Phase 2 polish: pre-seed the global assistant from THIS
  // trip's context. Same hook /home uses. Button hides until center
  // is known (never broken).
  const tripCenter = useTripCenter(trip.id);
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
              href={`/navigate?to=${encodeURIComponent(trip.title)}` as never}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-brand-900 shadow-(--shadow-depth-1) transition hover:opacity-90"
              style={{ backgroundImage: 'var(--gradient-gold)' }}
            >
              🧭 Navigate
            </Link>
            <Link
              href={
                `/diary?tripId=${encodeURIComponent(trip.id)}&title=${encodeURIComponent(`Day in ${trip.title}`)}` as never
              }
              className="inline-flex items-center gap-1 rounded-md border border-gold-600/25 px-3 py-1.5 text-sm font-medium text-gold-700 transition hover:bg-gold-500/10 dark:text-gold-300"
            >
              ✍️ Write diary
            </Link>
            {tripCenter ? (
              <button
                type="button"
                onClick={() =>
                  openAssistantWith({ title: trip.title, center: tripCenter, tripId: trip.id })
                }
                className="inline-flex items-center gap-1 rounded-md border border-gold-600/25 px-3 py-1.5 text-sm font-medium text-gold-700 transition hover:bg-gold-500/10 dark:text-gold-300"
              >
                ✨ Plan with AI
              </button>
            ) : null}
            <Link
              href={`/trips/${trip.id}/overview` as never}
              className="inline-flex items-center gap-1 rounded-md border border-gold-600/25 px-3 py-1.5 text-sm font-medium text-gold-700 transition hover:bg-gold-500/10 dark:text-gold-300"
            >
              Overview
            </Link>
            <Link
              href={`/trips/${trip.id}/recap` as never}
              className="inline-flex items-center gap-1 rounded-md border border-gold-600/25 px-3 py-1.5 text-sm font-medium text-gold-700 transition hover:bg-gold-500/10 dark:text-gold-300"
            >
              ✨ Recap
            </Link>
            <Link
              href={`/trips/${trip.id}/expenses` as never}
              className="inline-flex items-center gap-1 rounded-md border border-gold-600/25 px-3 py-1.5 text-sm font-medium text-gold-700 transition hover:bg-gold-500/10 dark:text-gold-300"
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
              className="inline-flex items-center gap-1 rounded-md border border-gold-600/25 px-3 py-1.5 text-sm font-medium text-gold-700 transition hover:bg-gold-500/10 dark:text-gold-300"
            >
              🌐 Primer
            </Link>
            {isOwner ? (
              isArchived ? (
                // When archived, every editable control is hidden;
                // only Unarchive is offered. Defence-in-depth — the
                // API also forbids edits on archived trips.
                <Button variant="outline" size="sm" onClick={onUnarchive} disabled={isUnarchiving}>
                  {isUnarchiving ? 'Unarchiving…' : '📂 Unarchive'}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDuplicate}
                    disabled={isDuplicating}
                  >
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
                  <Button variant="outline" size="sm" onClick={onAskArchive}>
                    🗄️ Archive
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onAskDelete}>
                    Delete
                  </Button>
                </>
              )
            ) : null}
          </div>
        </div>
        {isArchived ? (
          <p className="mt-2 rounded-md border border-slate-500/30 bg-slate-500/5 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
            🗄️ <strong>Archived.</strong> Hidden from your trip list. Reads still work via this
            direct URL. Unarchive to reopen for edits + put it back in your list.
          </p>
        ) : trip.status === 'published' ? (
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            🔒 <strong>Locked.</strong> Share collaborators can read + vote + log expenses, but only
            you can edit the itinerary or trip metadata. Unlock to reopen edits.
          </p>
        ) : null}
        {duplicateErrorMsg ? (
          <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {duplicateErrorMsg}
          </p>
        ) : null}
      </CardHeader>
      <p className="text-sm text-muted">
        {(() => {
          const starts = coerceTripDate(trip.startsOn);
          const ends = coerceTripDate(trip.endsOn);
          return starts && ends ? (
            <>
              {new Date(starts).toLocaleDateString()} → {new Date(ends).toLocaleDateString()}
            </>
          ) : (
            'No dates yet'
          );
        })()}
      </p>
      <p className="mt-2 text-xs text-muted">
        Created {new Date(trip.createdAt).toLocaleString()} · Updated{' '}
        {new Date(trip.updatedAt).toLocaleString()}
      </p>
      {/* J1 — owner-only publish-to-feed control. Self-contained:
          reads its own publication status + handles publish /
          unpublish. The API privacy-fences this to ended trips. */}
      {isOwner ? <PublishPanel tripId={trip.id} endsOn={coerceTripDate(trip.endsOn)} /> : null}
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
  const [startsOn, setStartsOn] = useState((coerceTripDate(trip.startsOn) ?? '').slice(0, 10));
  const [endsOn, setEndsOn] = useState((coerceTripDate(trip.endsOn) ?? '').slice(0, 10));
  // G4 — let the user opt in to shifting the existing itinerary by
  // the same delta when they change startsOn.
  const [shiftItinerary, setShiftItinerary] = useState(true);
  const [shiftResult, setShiftResult] = useState<string | null>(null);

  // G4 — compute the delta in whole days so the inline hint can
  // tell the user exactly what will happen. Null when startsOn
  // hasn't changed, or either side is unparseable.
  const oldStarts = (coerceTripDate(trip.startsOn) ?? '').slice(0, 10);
  const startsOnDelta: number | null = (() => {
    if (!startsOn || !oldStarts || startsOn === oldStarts) return null;
    const a = new Date(`${oldStarts}T00:00:00`).getTime();
    const b = new Date(`${startsOn}T00:00:00`).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round((b - a) / 86_400_000);
  })();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setShiftResult(null);
    const patch: UpdateTripRequestDto = {};
    if (title !== trip.title) patch.title = title;
    const r = Number(radiusKm);
    if (Number.isFinite(r) && r !== trip.radiusKm) patch.radiusKm = r;
    const oldEnds = (coerceTripDate(trip.endsOn) ?? '').slice(0, 10);
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
    // G4 — fire the shift in parallel with the trip update. Both
    // are owner-gated; ordering doesn't matter (the shift updates
    // ItineraryDay rows directly, not via the trip patch). Fire-and-
    // forget — a failed shift surfaces to the inline status line.
    if (shiftItinerary && startsOnDelta !== null && startsOnDelta !== 0) {
      void (
        tripControllerShiftItinerary(trip.id, {
          body: JSON.stringify({ deltaDays: startsOnDelta }),
          headers: { 'content-type': 'application/json' },
        }) as unknown as Promise<{ data: { shifted: number } }>
      )
        .then((res) => {
          const n = res.data?.shifted ?? 0;
          setShiftResult(n > 0 ? `Shifted ${n} itinerary day${n === 1 ? '' : 's'}.` : null);
        })
        .catch(() => {
          setShiftResult('Could not shift the itinerary — your trip update still went through.');
        });
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
        {/* G4 — when startsOn changes, offer to slide the existing
            itinerary by the same delta. Only renders when there's
            actually a delta. Bounded ±365 days at the API. */}
        {startsOnDelta !== null && Math.abs(startsOnDelta) <= 365 ? (
          <label className="flex items-start gap-2 rounded-xl border border-gold-600/20 bg-gold-500/4 px-3 py-2 text-xs text-muted">
            <input
              type="checkbox"
              className="mt-0.5 accent-gold-600"
              checked={shiftItinerary}
              onChange={(e) => setShiftItinerary(e.target.checked)}
            />
            <span>
              Also shift my itinerary{' '}
              <span className="text-surface-foreground">
                {startsOnDelta > 0
                  ? `forward ${startsOnDelta} day${startsOnDelta === 1 ? '' : 's'}`
                  : `back ${Math.abs(startsOnDelta)} day${Math.abs(startsOnDelta) === 1 ? '' : 's'}`}
              </span>{' '}
              so the existing plan follows the new start date.
            </span>
          </label>
        ) : null}
        {shiftResult ? (
          <p className="rounded-md border border-gold-600/30 bg-gold-500/8 px-3 py-2 text-xs text-gold-700 dark:text-gold-300">
            {shiftResult}
          </p>
        ) : null}
        {errorMsg ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm text-red-600 dark:text-red-400">
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
        <p className="mb-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {genErr}
        </p>
      ) : null}
      {isLoading ? (
        <Skeleton className="h-4 w-2/3" count={3} />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Couldn't load itinerary.</p>
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
    <li className="rounded-xl border border-gold-600/12 p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <strong className="font-display text-sm font-semibold tracking-tight text-surface-foreground">
          Day {day.dayIndex + 1}
        </strong>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted">{dateStr}</span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs font-medium text-gold-600 hover:underline"
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
            const initialCompletedAt = (it as { completedAt?: string | null }).completedAt ?? null;
            return (
              <li key={it.id} className="flex items-start justify-between gap-2 py-1">
                <span className="flex-1 inline-flex items-start gap-1.5">
                  <ItemCheckbox itemId={it.id} initialCompletedAt={initialCompletedAt} />
                  <span>
                    {notes ?? <em>(no notes)</em>}
                    {placeId ? (
                      <span className="ml-1 opacity-70">({placeId.slice(0, 8)}…)</span>
                    ) : null}
                  </span>
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
              className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-xl border border-gold-600/12 p-2 text-xs"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-muted hover:text-gold-600 disabled:opacity-30"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="text-muted hover:text-gold-600 disabled:opacity-30"
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
                className="rounded-lg border border-gold-600/25 bg-surface px-2 py-1 text-xs text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              />
              <input
                type="text"
                value={it.placeId}
                onChange={(e) => patchItem(idx, { placeId: e.target.value })}
                placeholder="Place id (optional)"
                className="rounded-lg border border-gold-600/25 bg-surface px-2 py-1 font-mono text-xs text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                aria-label="Remove item"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {errMsg ? (
        <p className="rounded border border-red-500/30 bg-red-500/5 px-2 py-1 text-xs text-red-600 dark:text-red-400">
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
        <p className="text-sm text-red-600 dark:text-red-400">Couldn't load media.</p>
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
    <li className="flex flex-col rounded-xl border border-gold-600/12 bg-surface/60 p-2 text-xs">
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
        <p className="mb-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
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
          <pre className="whitespace-pre-wrap rounded-xl border border-gold-600/12 bg-surface/60 px-3 py-2 font-sans text-sm leading-relaxed">
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
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000';
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
        <p className="mb-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
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
