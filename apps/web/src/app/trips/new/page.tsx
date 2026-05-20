/**
 * Trip composer (upgraded — Phase 2, page E).
 *
 * E1 trip type · E2 continent → famous destinations (curated $0
 * dataset, coords baked in — no geocoding) · E3 days/nights + radius
 * + state/region + the traveller's saved preferences folded in · E4
 * on create, fire the AI planner with a composed `instruction` so
 * the itinerary reflects ALL of it (transient — no schema change).
 *
 * The map-picker + manual coords + frequent-locations + duration
 * presets from the original flow are preserved as the "anywhere"
 * path. Auth-gated like /trips.
 *
 * Installed by [IV.18.19.25]; upgraded for Phase 2 — Create-Trip.
 */
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiFetch,
  getTripControllerListQueryKey,
  useTripControllerCreate,
  usePreferencesControllerGetMine,
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
import { CONTINENTS, DESTINATIONS } from '../../../data/destinations';

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

const TRIP_TYPES: readonly string[] = [
  'Adventure',
  'Relaxation',
  'Culture & history',
  'Food & markets',
  'Nature & wildlife',
  'Nightlife',
  'Road trip',
  'Wellness',
  'Family',
  'Budget / backpacking',
];

type DurationPresetKey = 'weekend' | 'long-weekend' | 'week';
const DURATION_PRESETS: readonly { key: DurationPresetKey; label: string }[] = [
  { key: 'weekend', label: 'Weekend (2 nights)' },
  { key: 'long-weekend', label: 'Long weekend (3 nights)' },
  { key: 'week', label: 'Week (7 nights)' },
];

function computeDurationPreset(key: DurationPresetKey): { startsOn: string; endsOn: string } {
  const now = new Date();
  const day = now.getDay();
  const daysToFriday = (5 - day + 7) % 7 || 7;
  const friday = new Date(now);
  friday.setHours(0, 0, 0, 0);
  friday.setDate(now.getDate() + daysToFriday);
  const nights = key === 'weekend' ? 2 : key === 'long-weekend' ? 3 : 7;
  const endsOn = new Date(friday);
  endsOn.setDate(friday.getDate() + nights);
  return { startsOn: toIsoDate(friday), endsOn: toIsoDate(endsOn) };
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nightsBetween(s: string, e: string): number | null {
  if (!s || !e) return null;
  const ms = new Date(e).getTime() - new Date(s).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 86_400_000);
}

// E6 — derive endsOn from startsOn + N nights. Pure: bad input → null.
const MIN_NIGHTS = 1;
const MAX_NIGHTS = 30;
function addNights(startsOn: string, nights: number): string | null {
  if (!startsOn) return null;
  const n = Math.round(nights);
  if (!Number.isFinite(n) || n < MIN_NIGHTS || n > MAX_NIGHTS) return null;
  const d = new Date(`${startsOn}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

interface PrefsLike {
  travelAura?: string | null;
  travelInterests?: unknown;
  budgetMode?: boolean;
  comfortMode?: boolean;
  familyMode?: boolean;
  nomadMode?: boolean;
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
  const [tripType, setTripType] = useState<string | null>(null);
  const [continents, setContinents] = useState<readonly string[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [region, setRegion] = useState('');
  const [picked, setPicked] = useState<string | null>(null); // "Dest · Country"
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [frequent, setFrequent] = useState<readonly FrequentLocation[]>([]);
  const [titleFocused, setTitleFocused] = useState(false);

  useEffect(() => {
    setFrequent(listFrequentLocations(''));
  }, []);

  const prefsQuery = usePreferencesControllerGetMine({ query: { enabled: token !== null } });
  const prefs = (prefsQuery.data as { data?: PrefsLike } | undefined)?.data;
  const interests: string[] = Array.isArray(prefs?.travelInterests)
    ? (prefs!.travelInterests as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  // F8 — has the user actually given us a travel style yet? Aura,
  // interests, OR any of the 4 modes counts. An "empty" prefs row
  // (defaults) shows the F8 setup CTA instead of the Personalised
  // band — the plan still gets generated, we just nudge the user
  // toward making future trips better.
  const personalisedParts: string[] = prefs
    ? [
        prefs.travelAura ? `style ${prefs.travelAura}` : null,
        interests.length > 0 ? `${interests.length} interests` : null,
        prefs.budgetMode ? 'budget' : null,
        prefs.comfortMode ? 'comfort' : null,
        prefs.familyMode ? 'family' : null,
        prefs.nomadMode ? 'nomad' : null,
      ].filter((s): s is string => s !== null)
    : [];

  // E5 — true cascade: continent(s) → countries within them → that
  // country's famous destinations.
  const countriesForSel = useMemo(() => {
    const out: { country: string; continent: string }[] = [];
    for (const c of continents) {
      for (const dc of DESTINATIONS[c] ?? []) {
        out.push({ country: dc.country, continent: c });
      }
    }
    return out;
  }, [continents]);

  const destsForCountry = useMemo(() => {
    if (!country) return [];
    const out: { dest: string; country: string; lat: number; lng: number }[] = [];
    for (const c of continents) {
      for (const dc of DESTINATIONS[c] ?? []) {
        if (dc.country !== country) continue;
        for (const d of dc.destinations) {
          out.push({ dest: d.name, country: dc.country, lat: d.lat, lng: d.lng });
        }
      }
    }
    return out;
  }, [continents, country]);

  function toggleContinent(c: string) {
    setContinents((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
    // A continent change can invalidate the drilled-down country.
    setCountry(null);
    setPicked(null);
  }

  function pickDestination(d: { dest: string; country: string; lat: number; lng: number }) {
    setPicked(`${d.dest} · ${d.country}`);
    setTitle(`${d.dest}${tripType ? ` — ${tripType}` : ''}`);
    setLat(d.lat.toFixed(6));
    setLng(d.lng.toFixed(6));
  }

  function applyDurationPreset(p: DurationPresetKey) {
    const { startsOn: s, endsOn: e } = computeDurationPreset(p);
    setStartsOn(s);
    setEndsOn(e);
  }

  // E6 — typed Nights input. Empty → clear endsOn but keep startsOn
  // (lets the user re-pick); valid value + startsOn → derive endsOn;
  // valid value without startsOn → keep the digits typed but no-op
  // on endsOn until they set a start.
  function onNightsChange(value: string) {
    const trimmed = value.trim();
    if (trimmed === '') {
      setEndsOn('');
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n)) return;
    const clamped = Math.min(MAX_NIGHTS, Math.max(MIN_NIGHTS, n));
    if (!startsOn) return;
    const next = addNights(startsOn, clamped);
    if (next) setEndsOn(next);
  }

  // E6 — when the start date changes and we have a current nights
  // value, slide endsOn to keep that length. Honest: if the user
  // hadn't set a nights count yet, we don't invent one.
  function onStartsOnChange(value: string) {
    setStartsOn(value);
    const cur = nightsBetween(startsOn, endsOn);
    if (value && cur !== null) {
      const next = addNights(value, cur);
      if (next) setEndsOn(next);
    }
  }

  function applyFrequentLocation(loc: FrequentLocation) {
    setTitle(loc.title);
    setLat(loc.lat.toFixed(6));
    setLng(loc.lng.toFixed(6));
    setRadiusKm(String(loc.radiusKm));
    setTitleFocused(false);
  }

  const titleSuggestions = title.trim()
    ? frequent.filter((e) => e.title.toLowerCase().includes(title.trim().toLowerCase()))
    : frequent;

  const nights = nightsBetween(startsOn, endsOn);

  // E4 — compose the planner instruction from every selected input.
  function buildInstruction(): string {
    const p: string[] = [];
    if (tripType) p.push(`Trip type: ${tripType}.`);
    if (region.trim()) p.push(`Focus region/state: ${region.trim()}.`);
    if (continents.length > 0) p.push(`Area of interest: ${continents.join(', ')}.`);
    if (nights) p.push(`About ${nights} night(s).`);
    if (prefs?.travelAura) p.push(`Traveller style: ${prefs.travelAura}.`);
    if (interests.length > 0) p.push(`Interests: ${interests.join(', ')}.`);
    if (prefs?.budgetMode) p.push('Keep it budget-conscious.');
    if (prefs?.comfortMode) p.push('Accessibility & comfort matter.');
    if (prefs?.familyMode) p.push('Family-friendly, travelling with kids.');
    if (prefs?.nomadMode) p.push('Digital-nomad friendly (good wifi, calmer pace).');
    return p.join(' ').slice(0, 600);
  }

  const createMutation = useTripControllerCreate({
    mutation: {
      onSuccess: async (response: { data?: unknown }) => {
        const trip = response.data as TripDto;
        recordLocation({
          title,
          lat: Number(lat),
          lng: Number(lng),
          radiusKm: Number(radiusKm),
        });
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListQueryKey({ limit: '20' } as never),
        });
        // E4 — fire the AI planner with the composed focus. Direct
        // apiFetch (additive optional body, no SDK regen); fire-and-
        // forget so a slow LLM never blocks the redirect — the trip
        // page surfaces the plan on its own.
        const instruction = buildInstruction();
        if (trip?.id) {
          void apiFetch(`/api/v1/trips/${trip.id}/plan-with-ai`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(instruction ? { instruction } : {}),
          }).catch(() => undefined);
          router.push(`/trips/${trip.id}` as never);
        } else {
          router.push('/trips');
        }
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
      setErrorMsg('Pick a destination on the map, from the famous picks, or type coordinates.');
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

  const chip = (active: boolean) =>
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ' +
    (active
      ? 'border-brand bg-brand/10 text-surface-foreground shadow-(--shadow-depth-1)'
      : 'border-gold-600/20 text-muted hover:border-brand/40 hover:text-surface-foreground');

  return (
    <main className="space-y-6">
      <p>
        <Link href="/trips" className="text-sm text-muted hover:underline">
          ← Back to trips
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Plan a new trip</h1>
        <p className="text-sm text-muted">
          Pick a vibe and a place — the AI builds the itinerary around it and your saved
          preferences.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-7">
        {/* E1 — trip type */}
        <section className="space-y-2">
          <span className="block text-sm font-medium text-surface-foreground">
            What kind of trip?
          </span>
          <div className="flex flex-wrap gap-2">
            {TRIP_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTripType((cur) => (cur === t ? null : t))}
                aria-pressed={tripType === t}
                className={chip(tripType === t)}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* E2 — continent → famous destinations */}
        <section className="space-y-2">
          <span className="block text-sm font-medium text-surface-foreground">
            Where in the world? <span className="text-muted">(pick one or more continents)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {CONTINENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleContinent(c)}
                aria-pressed={continents.includes(c)}
                className={chip(continents.includes(c))}
              >
                {c}
              </button>
            ))}
          </div>
          {countriesForSel.length > 0 ? (
            <div className="space-y-2 pt-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted">
                Countries across {continents.join(', ')}
              </span>
              <div className="flex flex-wrap gap-2">
                {countriesForSel.map((c) => (
                  <button
                    key={`${c.continent}:${c.country}`}
                    type="button"
                    onClick={() => {
                      setCountry((cur) => (cur === c.country ? null : c.country));
                      setPicked(null);
                    }}
                    aria-pressed={country === c.country}
                    className={chip(country === c.country)}
                  >
                    {c.country}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {destsForCountry.length > 0 ? (
            <div className="space-y-2 pt-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted">
                Famous in {country} — pick one (or use the map below for anywhere)
              </span>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {destsForCountry.map((d) => {
                  const id = `${d.dest} · ${d.country}`;
                  const active = picked === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => pickDestination(d)}
                        aria-pressed={active}
                        className={
                          'w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ' +
                          (active
                            ? 'border-brand bg-brand/10 shadow-(--shadow-depth-1)'
                            : 'border-gold-600/15 hover:border-brand/40 hover:shadow-(--shadow-depth-1)')
                        }
                      >
                        <span className="block font-medium text-surface-foreground">{d.dest}</span>
                        <span className="block text-xs text-muted">{d.country}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>

        {/* Title + recent-destination autocomplete (preserved) */}
        <div className="relative">
          <Field
            label="Trip title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => window.setTimeout(() => setTitleFocused(false), 120)}
            required
            help="Auto-filled when you pick a destination. 1..120 characters."
            autoComplete="off"
          />
          {titleFocused && titleSuggestions.length > 0 ? (
            <ul
              role="listbox"
              aria-label="Recent destinations"
              className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-md border border-muted/30 bg-surface shadow-lg"
            >
              {titleSuggestions.map((loc) => (
                <li key={loc.title}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
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

        {/* Center map + coords (preserved "anywhere" path) */}
        <div className="space-y-2">
          <span className="block text-sm font-medium text-surface-foreground">Exact centre</span>
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
              setLng(nextLng.toFixed(6));
              setLat(nextLat.toFixed(6));
            }}
          />
          <p className="text-xs text-muted">
            A famous pick drops the pin for you — fine-tune it here, or click anywhere.
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

        {/* E3 — radius + state/region + days/nights */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Travel radius (km)"
            type="number"
            step="any"
            min={1}
            max={500}
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            required
            help="How far from the centre to plan. 1..500"
          />
          <Field
            label="State / region (optional)"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            help="e.g. Tuscany, Kerala, Bavaria — sharpens the plan."
          />
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-surface-foreground">Trip length</span>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((p) => {
              const target = computeDurationPreset(p.key);
              const active = startsOn === target.startsOn && endsOn === target.endsOn;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyDurationPreset(p.key)}
                  aria-pressed={active}
                  className={chip(active)}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Starts on (optional)"
              type="date"
              value={startsOn}
              onChange={(e) => onStartsOnChange(e.target.value)}
            />
            <Field
              label="Nights"
              type="number"
              step={1}
              min={MIN_NIGHTS}
              max={MAX_NIGHTS}
              value={nights ?? ''}
              onChange={(e) => onNightsChange(e.target.value)}
              help={
                startsOn
                  ? `1..${MAX_NIGHTS} · ends ${nights ? (addNights(startsOn, nights) ?? '—') : '—'}`
                  : 'Set a start date to derive the end.'
              }
            />
            <Field
              label="Ends on (optional)"
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              help={nights ? `${nights} night(s)` : '≥ starts on, when both set.'}
            />
          </div>
        </div>

        {/* E3 — preferences applied (read-only, folded into the plan).
            F8 — when prefs is loaded but empty, swap to a calm "set
            up your travel style" CTA instead of an empty band. */}
        {prefs && personalisedParts.length > 0 ? (
          <p className="rounded-xl border border-gold-600/20 bg-gold-500/5 px-4 py-2.5 text-xs text-muted">
            <span className="font-medium text-surface-foreground">Personalised:</span>{' '}
            {personalisedParts.join(' · ')} — applied to this itinerary.{' '}
            <Link href="/account/preferences" className="text-gold-600 hover:underline">
              Edit
            </Link>
          </p>
        ) : prefs ? (
          <p className="rounded-xl border border-gold-600/20 bg-gold-500/5 px-4 py-2.5 text-xs text-muted">
            <span className="font-medium text-surface-foreground">
              Make this trip more personal:
            </span>{' '}
            the AI plans better when it knows your style. Takes about a minute.{' '}
            <Link href="/onboarding?tour=true" className="text-gold-600 hover:underline">
              Set your travel style →
            </Link>
          </p>
        ) : null}

        {errorMsg ? (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
            {errorMsg}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" variant="royal" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create trip & generate plan'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/trips')}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
