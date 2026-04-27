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
import {
  listFrequentLocations,
  recordLocation,
  type FrequentLocation,
} from '../../../lib/frequent-locations';
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

/**
 * V.UX.4 weekend-traveler quick picks. Each preset computes a date
 * range starting from the next upcoming Friday so a Tuesday-evening
 * planner sees fresh dates rather than yesterday's weekend.
 */
type DurationPresetKey = 'weekend' | 'long-weekend' | 'week';

interface DurationPreset {
  readonly key: DurationPresetKey;
  readonly label: string;
}

const DURATION_PRESETS: readonly DurationPreset[] = [
  { key: 'weekend', label: 'Weekend (2 nights)' },
  { key: 'long-weekend', label: 'Long weekend (3 nights)' },
  { key: 'week', label: 'Week (7 nights)' },
];

function computeDurationPreset(key: DurationPresetKey): { startsOn: string; endsOn: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun .. 6 = Sat
  // Next Friday — if today is Friday, jump 7 days ahead so a "weekend"
  // chip doesn't dump tomorrow on someone who's still planning.
  const daysToFriday = (5 - day + 7) % 7 || 7;
  const friday = new Date(now);
  friday.setHours(0, 0, 0, 0);
  friday.setDate(now.getDate() + daysToFriday);

  const nights = key === 'weekend' ? 2 : key === 'long-weekend' ? 3 : 7;
  const startsOn = friday;
  const endsOn = new Date(friday);
  endsOn.setDate(friday.getDate() + nights);
  return { startsOn: toIsoDate(startsOn), endsOn: toIsoDate(endsOn) };
}

function toIsoDate(d: Date): string {
  // YYYY-MM-DD in local time — what <input type="date"> wants.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
  const [frequent, setFrequent] = useState<readonly FrequentLocation[]>([]);
  const [titleFocused, setTitleFocused] = useState(false);

  // Hydrate the frequent-locations memory client-side. localStorage
  // touches `window` so we can't read it during prerender.
  useEffect(() => {
    setFrequent(listFrequentLocations(''));
  }, []);

  function applyDurationPreset(preset: DurationPresetKey) {
    const { startsOn: s, endsOn: e } = computeDurationPreset(preset);
    setStartsOn(s);
    setEndsOn(e);
  }

  function applyFrequentLocation(loc: FrequentLocation) {
    setTitle(loc.title);
    setLat(loc.lat.toFixed(6));
    setLng(loc.lng.toFixed(6));
    setRadiusKm(String(loc.radiusKm));
    setTitleFocused(false);
  }

  // Filter the suggestion list by the typed title (case-insensitive
  // substring). Empty title shows the full top-5.
  const titleSuggestions = title.trim()
    ? frequent.filter((e) => e.title.toLowerCase().includes(title.trim().toLowerCase()))
    : frequent;

  const createMutation = useTripControllerCreate({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        const trip = response.data as TripDto;
        // Persist the destination so the next /trips/new visit
        // autocompletes. Validation here mirrors onSubmit's parsing
        // — the mutation only fires when those values are finite.
        recordLocation({
          title,
          lat: Number(lat),
          lng: Number(lng),
          radiusKm: Number(radiusKm),
        });
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
        <div className="relative">
          <Field
            label="Title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => {
              // Delay so a click on the dropdown lands before it unmounts.
              window.setTimeout(() => setTitleFocused(false), 120);
            }}
            required
            help="1..120 characters. Recent destinations autocomplete below."
            autoComplete="off"
          />
          {titleFocused && titleSuggestions.length > 0 ? (
            <ul
              role="listbox"
              aria-label="Recent destinations"
              className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-md border border-muted/30 bg-background shadow-lg"
            >
              {titleSuggestions.map((loc) => (
                <li key={loc.title}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // Prevent the input's blur from firing before our
                      // click handler — otherwise the dropdown unmounts.
                      e.preventDefault();
                      applyFrequentLocation(loc);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/10"
                  >
                    <span className="truncate font-medium">{loc.title}</span>
                    <span className="font-mono text-[10px] text-muted">
                      {loc.lat.toFixed(2)}, {loc.lng.toFixed(2)} · {loc.radiusKm}km
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
        <div className="space-y-2">
          <span className="block text-sm font-medium">Trip length</span>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((p) => {
              // The "active" check matches when both date fields equal what
              // the preset would produce — that way a hand-tweaked range
              // doesn't show a misleading active chip.
              const target = computeDurationPreset(p.key);
              const active = startsOn === target.startsOn && endsOn === target.endsOn;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyDurationPreset(p.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    active
                      ? 'border-brand bg-brand text-brand-foreground'
                      : 'border-muted/30 text-muted hover:bg-muted/10'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Quick picks auto-fill the dates below. You can still tweak them.
          </p>
        </div>
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
