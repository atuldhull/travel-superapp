/**
 * Trip composer. POST /trips with { title, center, radiusKm,
 * startsOn?, endsOn? }. On success the React Query cache for
 * `useTripControllerList` is invalidated so the destination /trips
 * page renders the new trip on next mount.
 *
 * Center input is two number fields (lng, lat). A real geocoder /
 * map-picker is a follow-up — this UI is the minimum that lets a
 * demo session create a trip end-to-end without curl.
 *
 * Auth-gated identically to /trips: bounce to /login if no token
 * after silent-refresh boot completes.
 *
 * Installed by prompt [IV.18.19.25].
 */
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getTripControllerListQueryKey,
  useTripControllerCreate,
  type CreateTripRequestDto,
  type TripDto,
} from '@app/sdk';
import { Button } from '../../../components/ui/button';
import { Field } from '../../../components/ui/input';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { useEffect } from 'react';

// MapPicker is client-only (Leaflet touches `window`). next/dynamic
// with ssr:false keeps it out of the prerender pass.
const MapPicker = dynamic(() => import('../../../components/map-picker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-md border border-muted/30 bg-muted/10" />
  ),
});

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function NewTripPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const [title, setTitle] = useState('');
  const [lng, setLng] = useState('');
  const [lat, setLat] = useState('');
  const [radiusKm, setRadiusKm] = useState('25');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useTripControllerCreate({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        const trip = response.data as TripDto;
        // Invalidate the trips list so /trips re-fetches on arrival.
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' }),
        });
        router.push('/trips');
        // Surface trip id in the URL so the destination page can flash
        // a success state in a follow-up slice.
        void trip;
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Create failed.'}`);
      },
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const lngN = Number(lng);
    const latN = Number(lat);
    const radiusN = Number(radiusKm);
    if (!Number.isFinite(lngN) || !Number.isFinite(latN) || !Number.isFinite(radiusN)) {
      setErrorMsg('Center coordinates and radius must all be numbers.');
      return;
    }
    const data: CreateTripRequestDto = {
      title,
      center: { lng: lngN, lat: latN },
      radiusKm: radiusN,
      ...(startsOn ? { startsOn: new Date(startsOn).toISOString() } : {}),
      ...(endsOn ? { endsOn: new Date(endsOn).toISOString() } : {}),
    };
    createMutation.mutate({ data });
  }

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

  return (
    <main className="space-y-6">
      <p>
        <Link href="/trips" className="text-sm text-muted hover:underline">
          ← Back to trips
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">New trip</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          help="1..120 characters."
        />
        <div className="space-y-2">
          <span className="block text-sm font-medium">Center</span>
          <MapPicker
            className="h-72 w-full"
            value={
              lng !== '' &&
              lat !== '' &&
              Number.isFinite(Number(lng)) &&
              Number.isFinite(Number(lat))
                ? { lng: Number(lng), lat: Number(lat) }
                : null
            }
            onChange={({ lng: nextLng, lat: nextLat }) => {
              // Round to 6 decimal places (~10cm precision) so the
              // text fields stay readable.
              setLng(nextLng.toFixed(6));
              setLat(nextLat.toFixed(6));
            }}
          />
          <p className="text-xs text-muted">
            Click the map to drop a pin. Or type coordinates below if you already know them.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Longitude"
              type="number"
              step="any"
              min={-180}
              max={180}
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
              help="-180..180"
            />
            <Field
              label="Latitude"
              type="number"
              step="any"
              min={-90}
              max={90}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
              help="-90..90"
            />
          </div>
        </div>
        <Field
          label="Radius (km)"
          type="number"
          step="any"
          min={1}
          max={500}
          value={radiusKm}
          onChange={(e) => setRadiusKm(e.target.value)}
          required
          help="1..500"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Starts on (optional)"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
          <Field
            label="Ends on (optional)"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            help="≥ starts on, when both set."
          />
        </div>
        {errorMsg ? (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
            {errorMsg}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create trip'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/trips')}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
