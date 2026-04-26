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
 * Installed by prompt [IV.18.19.29].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getTripControllerGetOneQueryKey,
  getTripControllerListQueryKey,
  useTripControllerGetOne,
  useTripControllerRemove,
  useTripControllerUpdate,
  type TripDto,
  type UpdateTripRequestDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
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
          queryKey: getTripControllerListQueryKey({ limit: '20' }),
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

  const deleteMutation = useTripControllerRemove({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' }),
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

  const trip = data as unknown as TripDto;

  return (
    <main className="space-y-6">
      <p>
        <Link href="/trips" className="text-sm text-muted hover:underline">
          ← Back to trips
        </Link>
      </p>
      {editing ? (
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
          onEdit={() => {
            setEditing(true);
            setErrorMsg(null);
          }}
          onAskDelete={() => {
            setConfirmDelete(true);
            setErrorMsg(null);
          }}
        />
      )}
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
  readonly onEdit: () => void;
  readonly onAskDelete: () => void;
}

function ReadView({ trip, onEdit, onAskDelete }: ReadViewProps) {
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
          <div className="flex gap-2">
            <Link
              href={`/trips/${trip.id}/overview` as never}
              className="inline-flex items-center gap-1 rounded-md border border-brand/30 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/5"
            >
              Overview
            </Link>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onAskDelete}>
              Delete
            </Button>
          </div>
        </div>
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
