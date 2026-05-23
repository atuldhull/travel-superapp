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
  countryPrimerControllerGet,
  getTripControllerListQueryKey,
  getWeatherControllerForecastUrl,
  tripControllerPlanWithAi,
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
import { reverseGeocodeCountryCode } from '../../../lib/geocode';

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

// F12 — "How you like to travel" controls. All fold into the
// planner instruction so the AI itinerary actually reflects them.
type Pace = 'slow' | 'balanced' | 'packed';
const PACES: readonly { key: Pace; label: string; phrase: string }[] = [
  {
    key: 'slow',
    label: 'Slow & relaxed',
    phrase: 'Slow pace — fewer beats per day, longer stops.',
  },
  {
    key: 'balanced',
    label: 'Balanced',
    phrase: 'Balanced pace — a couple of highlights per day with downtime.',
  },
  {
    key: 'packed',
    label: 'Pack it in',
    phrase: 'Packed pace — fit as many highlights as possible per day.',
  },
];

type BudgetTier = 'shoestring' | 'comfort' | 'luxury';
const BUDGETS: readonly { key: BudgetTier; label: string; phrase: string }[] = [
  {
    key: 'shoestring',
    label: '⛺ Shoestring',
    phrase: 'Shoestring budget — hostels, street food, public transport.',
  },
  {
    key: 'comfort',
    label: '🏨 Comfort',
    phrase: 'Comfort budget — 3-star stays, mid-range eats, occasional taxis.',
  },
  {
    key: 'luxury',
    label: '🌟 Luxury',
    phrase: 'Luxury budget — boutique/5-star stays, fine dining, private transport.',
  },
];

type GroupKind = 'solo' | 'couple' | 'family' | 'group';
const GROUPS: readonly { key: GroupKind; label: string; phrase: string }[] = [
  { key: 'solo', label: 'Solo', phrase: 'Travelling solo.' },
  { key: 'couple', label: 'Couple', phrase: 'Couple travel — romantic spots welcome.' },
  {
    key: 'family',
    label: 'Family w/ kids',
    phrase: 'Family with kids — keep activities child-friendly.',
  },
  { key: 'group', label: 'Group of friends', phrase: 'Group of friends — social spots welcome.' },
];

const CONSTRAINTS: readonly { key: string; label: string; phrase: string }[] = [
  { key: 'no-fly', label: 'No flying', phrase: 'Avoid flights — ground transport only.' },
  {
    key: 'step-free',
    label: 'Step-free / accessible',
    phrase: 'Accessibility is required — step-free routes only.',
  },
  { key: 'vegetarian', label: 'Vegetarian', phrase: 'Vegetarian-friendly food only.' },
  { key: 'vegan', label: 'Vegan', phrase: 'Vegan-friendly food only.' },
  { key: 'halal', label: 'Halal', phrase: 'Halal food only.' },
  { key: 'kosher', label: 'Kosher', phrase: 'Kosher food only.' },
  { key: 'gluten-free', label: 'Gluten-free', phrase: 'Gluten-free food only.' },
  { key: 'no-spicy', label: 'No spicy food', phrase: 'Avoid spicy food.' },
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
// F19 — raised the cap from 30 to 90 to cover digital-nomad / extended
// sabbatical trips. The trip schema doesn't have a cap on this field.
const MIN_NIGHTS = 1;
const MAX_NIGHTS = 90;
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
  // F12 — how-you-travel selectors (all optional; fold into the AI
  // instruction so the plan actually reflects them).
  const [pace, setPace] = useState<Pace | null>(null);
  const [budget, setBudget] = useState<BudgetTier | null>(null);
  const [groupKind, setGroupKind] = useState<GroupKind | null>(null);
  const [constraintKeys, setConstraintKeys] = useState<readonly string[]>([]);
  // F19 — track the last auto-filled title so picking a NEW destination
  // refreshes the title only when the user hasn't typed their own.
  const [lastAutoTitle, setLastAutoTitle] = useState<string | null>(null);

  // F24 + F25 — destination context. Reverse-geocodes the picked
  // coords once we have them, then fires two cheap fetches:
  //   - climate (if startsOn is within Open-Meteo's 16-day horizon)
  //   - visa + top scams (country primer; curated subset)
  // All optional + honest fallbacks — nothing renders without data.
  interface DestContext {
    readonly countryCode: string;
    readonly visaInfo: string | null;
    readonly topScams: readonly string[];
    readonly forecast: {
      readonly date: string;
      readonly maxC: number;
      readonly minC: number;
      readonly precipPct: number | null;
    } | null;
    readonly forecastDeferred: boolean; // startsOn beyond the 16-day horizon
  }
  const [destContext, setDestContext] = useState<DestContext | null>(null);

  useEffect(() => {
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      setDestContext(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const cc = await reverseGeocodeCountryCode(latN, lngN);
        if (!alive) return;
        if (!cc) {
          setDestContext(null);
          return;
        }
        // Country primer (visa + scams) — auth-gated, may 404 for
        // un-seeded countries. Forecast — public, 16-day max.
        const horizonDays = (() => {
          if (!startsOn) return null;
          const target = new Date(`${startsOn}T00:00:00`).getTime();
          if (!Number.isFinite(target)) return null;
          return Math.round((target - Date.now()) / 86_400_000);
        })();
        const wantForecast = horizonDays !== null && horizonDays >= 0 && horizonDays <= 16;
        const forecastDeferred = horizonDays !== null && horizonDays > 16;
        const days = wantForecast && horizonDays !== null ? Math.max(1, horizonDays + 1) : 0;
        const [primerR, forecastR] = await Promise.allSettled([
          countryPrimerControllerGet(cc) as unknown as Promise<{
            data: { visaInfo?: string; topScamCategories?: readonly string[] };
          }>,
          // Weather forecast: orval-@Query() limitation (controller's
          // Zod pipe doesn't surface as typed params in OpenAPI), so
          // build the URL via the SDK's getter + apiFetch. ALL plumbing
          // still lives in @app/sdk — no raw URL strings.
          wantForecast
            ? apiFetch<{
                data: {
                  days?: ReadonlyArray<{
                    date?: string;
                    maxTempC?: number;
                    minTempC?: number;
                    precipitationProbabilityPercent?: number | null;
                  }>;
                };
                status: number;
                headers: Headers;
              }>(`${getWeatherControllerForecastUrl()}?lat=${latN}&lng=${lngN}&days=${days}`, {
                method: 'GET',
              })
            : Promise.resolve(null),
        ]);
        if (!alive) return;
        const primer =
          primerR.status === 'fulfilled' && primerR.value.data ? primerR.value.data : null;
        let forecast: DestContext['forecast'] = null;
        if (forecastR.status === 'fulfilled' && forecastR.value) {
          const allDays = forecastR.value.data?.days ?? [];
          // Find the day matching startsOn (Open-Meteo emits ISO
          // dates "YYYY-MM-DD" anchored to provider TZ).
          const match = allDays.find((d) => d.date === startsOn);
          if (match && typeof match.maxTempC === 'number' && typeof match.minTempC === 'number') {
            forecast = {
              date: match.date ?? startsOn,
              maxC: match.maxTempC,
              minC: match.minTempC,
              precipPct:
                typeof match.precipitationProbabilityPercent === 'number'
                  ? match.precipitationProbabilityPercent
                  : null,
            };
          }
        }
        setDestContext({
          countryCode: cc,
          visaInfo: typeof primer?.visaInfo === 'string' ? primer.visaInfo : null,
          topScams: Array.isArray(primer?.topScamCategories)
            ? (primer.topScamCategories as readonly string[]).slice(0, 4)
            : [],
          forecast,
          forecastDeferred,
        });
      } catch {
        if (alive) setDestContext(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lat, lng, startsOn]);

  function toggleConstraint(k: string) {
    setConstraintKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }

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
    // F19 — only auto-fill the title if it's empty OR still matches
    // the previous auto-fill. Once the user types their own, picking
    // a different destination still updates lat/lng but respects the
    // typed title.
    const auto = `${d.dest}${tripType ? ` — ${tripType}` : ''}`;
    if (title.trim() === '' || title === lastAutoTitle) {
      setTitle(auto);
      setLastAutoTitle(auto);
    }
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
  // F12 — pace + budget tier + group kind + diet/accessibility
  // constraints fold in at the end so they sit alongside the saved
  // preferences signals.
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
    if (pace) {
      const phrase = PACES.find((x) => x.key === pace)?.phrase;
      if (phrase) p.push(phrase);
    }
    if (budget) {
      const phrase = BUDGETS.find((x) => x.key === budget)?.phrase;
      if (phrase) p.push(phrase);
    }
    if (groupKind) {
      const phrase = GROUPS.find((x) => x.key === groupKind)?.phrase;
      if (phrase) p.push(phrase);
    }
    for (const key of constraintKeys) {
      const phrase = CONSTRAINTS.find((c) => c.key === key)?.phrase;
      if (phrase) p.push(phrase);
    }
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
        // E4 — fire the AI planner with the composed focus. Fire-and-
        // forget so a slow LLM never blocks the redirect — the trip
        // page surfaces the plan on its own.
        const instruction = buildInstruction();
        if (trip?.id) {
          void tripControllerPlanWithAi(trip.id, {
            body: JSON.stringify(instruction ? { instruction } : {}),
            headers: { 'content-type': 'application/json' },
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
    // F19 — reject past startsOn even if a user bypassed the date
    // picker's `min` attribute (keyboard entry, paste). The browser
    // attribute is the soft gate; this is the hard one.
    if (startsOn) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(`${startsOn}T00:00:00`);
      if (Number.isFinite(start.getTime()) && start.getTime() < today.getTime()) {
        setErrorMsg('Start date can’t be in the past.');
        return;
      }
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
              min={toIsoDate(new Date())}
              onChange={(e) => onStartsOnChange(e.target.value)}
              help="Can't be in the past."
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

        {/* F24 + F25 — destination context. Only renders when there's
            anything honest to show (visa / scams / forecast). */}
        {destContext &&
        (destContext.visaInfo ||
          destContext.topScams.length > 0 ||
          destContext.forecast ||
          destContext.forecastDeferred) ? (
          <section className="space-y-3 rounded-xl border border-brand/15 bg-brand/[0.03] p-4">
            <span className="block text-sm font-medium text-surface-foreground">
              About this destination <span className="text-muted">({destContext.countryCode})</span>
            </span>
            {destContext.forecast ? (
              <p className="text-xs text-muted">
                <span className="font-medium text-surface-foreground">
                  Forecast for {destContext.forecast.date}:
                </span>{' '}
                {Math.round(destContext.forecast.maxC)}° / {Math.round(destContext.forecast.minC)}°
                {destContext.forecast.precipPct !== null && destContext.forecast.precipPct > 0
                  ? ` · ${destContext.forecast.precipPct}% rain chance`
                  : ''}
                {destContext.forecast.precipPct !== null && destContext.forecast.precipPct >= 60 ? (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    — pack a rain jacket.
                  </span>
                ) : null}
              </p>
            ) : destContext.forecastDeferred ? (
              <p className="text-xs text-muted">
                We&apos;ll show the live forecast here once your trip is within 16 days.
              </p>
            ) : null}
            {destContext.visaInfo ? (
              <p className="text-xs text-muted">
                <span className="font-medium text-surface-foreground">Visa:</span>{' '}
                {destContext.visaInfo}
              </p>
            ) : null}
            {destContext.topScams.length > 0 ? (
              <div className="space-y-1.5">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted">
                  Watch out for
                </span>
                <ul className="flex flex-wrap gap-1.5">
                  {destContext.topScams.map((scam) => (
                    <li
                      key={scam}
                      className="inline-flex items-center rounded-full border border-gold-600/20 bg-gold-500/5 px-2.5 py-0.5 text-xs text-surface-foreground"
                    >
                      {scam}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* F12 — How you like to travel. All optional; each selection
            folds into buildInstruction() so the AI plan reflects them. */}
        <section className="space-y-3 rounded-xl border border-gold-600/15 bg-gold-500/[0.03] p-4">
          <span className="block text-sm font-medium text-surface-foreground">
            How you like to travel <span className="text-muted">(optional)</span>
          </span>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              Pace
            </span>
            <div className="flex flex-wrap gap-2">
              {PACES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPace((cur) => (cur === p.key ? null : p.key))}
                  aria-pressed={pace === p.key}
                  className={chip(pace === p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              Budget
            </span>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBudget((cur) => (cur === b.key ? null : b.key))}
                  aria-pressed={budget === b.key}
                  className={chip(budget === b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              Group
            </span>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGroupKind((cur) => (cur === g.key ? null : g.key))}
                  aria-pressed={groupKind === g.key}
                  className={chip(groupKind === g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              Diet &amp; accessibility <span className="text-muted/70">(pick any that apply)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {CONSTRAINTS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleConstraint(c.key)}
                  aria-pressed={constraintKeys.includes(c.key)}
                  className={chip(constraintKeys.includes(c.key))}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>

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
