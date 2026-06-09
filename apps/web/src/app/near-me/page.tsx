/**
 * V.UX.7 spontaneous-improviser dashboard. Phone-first single-screen
 * "what's near me right now" view.
 *
 * Flow:
 *   1. On mount: hydrate from IndexedDB so an offline / cold-load
 *      page still shows last-good data with a stale-timestamp badge.
 *   2. User taps "Near me" → browser geolocation → POST /near-me →
 *      render places + weather + safety. Persist to IDB.
 *   3. Voice input: Web Speech API listens for one phrase, drops it
 *      into the search bar. (Speech-to-place is a stub — V1 just
 *      shows the captured query; a future slice can route by intent.)
 *
 * Public — no auth needed; the api endpoint is `@Public()`.
 *
 * Installed by prompt [V.UX.7]; restyled into the v2 ("Fusion") design
 * language (royal/gold tokens, font-display, cinematic header band).
 */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CloudSun, MapPin, Mic, Navigation, ShieldCheck } from 'lucide-react';
import {
  useNearMeControllerNearMe,
  type NearMeNowRequestDto,
  type NearMeNowResponseDto,
} from '@app/sdk';
import { SafetyBadge } from '../../components/safety/safety-badge';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { PlaceCard } from '../../components/near-me/place-card';
import { loadNearMeResponse, saveNearMeResponse } from '../../lib/offline-cache';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

// Shared field styling so the voice query input reads as one set.
const FIELD =
  'rounded-xl border border-gold-600/25 bg-surface px-3.5 py-2.5 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

export default function NearMePage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [response, setResponse] = useState<NearMeNowResponseDto | null>(null);
  const [stale, setStale] = useState<{ fetchedAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);

  // Hydrate from IDB on mount so a cold-load + offline visit still
  // shows the last-good response.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await loadNearMeResponse<NearMeNowResponseDto>();
      if (cancelled || !cached) return;
      setResponse(cached.response);
      setStale({ fetchedAt: cached.fetchedAt });
      setCoords(cached.center);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nearMeMutation = useNearMeControllerNearMe({
    mutation: {
      onSuccess: async (resp: { data?: unknown }, variables: { data: NearMeNowRequestDto }) => {
        const body = resp.data as NearMeNowResponseDto;
        setResponse(body);
        setStale(null);
        setErrMsg(null);
        await saveNearMeResponse({
          center: variables.data.center,
          response: body,
        });
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Lookup failed.'}`);
      },
    },
  });

  function fetchNearMe() {
    setErrMsg(null);
    if (!('geolocation' in navigator)) {
      setErrMsg('Geolocation is not available on this device.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        nearMeMutation.mutate({
          data: { center: c, radiusKm: 3 } as NearMeNowRequestDto,
        });
        setBusy(false);
      },
      (err) => {
        setErrMsg(`Geolocation denied: ${err.message}`);
        setBusy(false);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  function startVoice() {
    setErrMsg(null);
    const Ctor =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).webkitSpeechRecognition;
    if (!Ctor) {
      setErrMsg('Voice input is not supported on this browser.');
      return;
    }
    const recogniser = new Ctor();
    recogniser.lang = navigator.language || 'en-US';
    recogniser.interimResults = false;
    recogniser.continuous = false;
    recogniser.onresult = (e) => {
      const first = e.results[0]?.[0]?.transcript ?? '';
      setVoiceQuery(first);
    };
    recogniser.onerror = () => setVoiceListening(false);
    recogniser.onend = () => setVoiceListening(false);
    setVoiceListening(true);
    recogniser.start();
  }

  // V.UX.7 — the voice/text query filters the already-fetched places by
  // name or category (the API has no text search; this makes the search
  // bar actually do something within the current radius).
  const query = voiceQuery.trim().toLowerCase();
  const visiblePlaces =
    response && query !== ''
      ? response.places.filter(
          (p) => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query),
        )
      : (response?.places ?? []);

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Navigation aria-hidden className="h-3.5 w-3.5" /> Right now
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Near me — right now
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          One tap. Five places, one weather glance, a safety read. No sign-in.
        </p>
      </header>

      <Card depth="raised" className="text-center">
        <Button
          type="button"
          variant="royal"
          size="lg"
          onClick={fetchNearMe}
          disabled={busy || nearMeMutation.isPending}
        >
          <MapPin aria-hidden className="mr-1.5 h-4 w-4" />
          {busy ? 'Locating…' : nearMeMutation.isPending ? 'Searching…' : 'Near me'}
        </Button>
        {coords ? (
          <p className="mt-3 font-mono text-[11px] text-muted">
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </p>
        ) : null}
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="near-me-voice" className="sr-only">
          What are you looking for
        </label>
        <input
          id="near-me-voice"
          type="text"
          value={voiceQuery}
          onChange={(e) => setVoiceQuery(e.target.value)}
          placeholder='Try saying "I want sushi"'
          className={`flex-1 ${FIELD}`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startVoice}
          disabled={voiceListening}
        >
          <Mic aria-hidden className="mr-1.5 h-3.5 w-3.5" />
          {voiceListening ? 'Listening…' : 'Speak'}
        </Button>
      </div>

      {errMsg ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {errMsg}
        </p>
      ) : null}

      {stale ? (
        <p className="rounded-2xl border border-gold-600/25 bg-gold-500/5 px-4 py-3 text-xs text-gold-700 dark:text-gold-300">
          Showing cached results from {new Date(stale.fetchedAt).toLocaleTimeString()}. Tap{' '}
          <strong>Near me</strong> to refresh.
        </p>
      ) : null}

      {response ? (
        <>
          <Card depth="raised">
            <CardHeader>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle>Right now</CardTitle>
                <span className="text-xs text-muted">
                  {new Date(response.fetchedAt).toLocaleTimeString()}
                </span>
              </div>
              <CardSubtitle>
                {response.places.length} place{response.places.length === 1 ? '' : 's'} within{' '}
                {response.radiusKm}km
              </CardSubtitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <WeatherTile weather={response.weather} />
              <SafetyTile safety={response.safety} />
              <CountTile count={response.places.length} />
            </div>
          </Card>

          {response.places.length === 0 ? (
            <Card depth="flat" className="p-5">
              <p className="text-sm text-muted">
                No places nearby in our catalog yet — try widening the search later.
              </p>
            </Card>
          ) : visiblePlaces.length === 0 ? (
            <Card depth="flat" className="p-5">
              <p className="text-sm text-muted">
                None of the {response.places.length} nearby place
                {response.places.length === 1 ? '' : 's'} match &ldquo;{voiceQuery.trim()}&rdquo;.
                Clear the search to see them all.
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {visiblePlaces.map((p) => (
                <PlaceCard
                  key={p.id}
                  place={p}
                  safety={{ score: response.safety.score, grade: response.safety.grade }}
                />
              ))}
            </ul>
          )}
        </>
      ) : null}

      <div className="text-center">
        <Link
          href="/"
          className="text-xs text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
        >
          ← Back home
        </Link>
      </div>
    </main>
  );
}

function WeatherTile({ weather }: { weather: NearMeNowResponseDto['weather'] }) {
  const today = weather.days[0];
  return (
    <div className="rounded-2xl border border-gold-600/12 bg-surface p-3 shadow-(--shadow-depth-1)">
      <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
        <CloudSun aria-hidden className="h-3 w-3 text-gold-600" /> Weather
      </p>
      {today ? (
        <p className="mt-1 font-mono text-sm text-surface-foreground">
          {Math.round(today.minTempC)}°–{Math.round(today.maxTempC)}°C
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">—</p>
      )}
      {today && typeof today.precipitationProbabilityPercent === 'number' ? (
        <p className="text-[10px] text-muted">
          {today.precipitationProbabilityPercent}% chance rain
        </p>
      ) : null}
    </div>
  );
}

function SafetyTile({ safety }: { safety: NearMeNowResponseDto['safety'] }) {
  return (
    <div className="rounded-2xl border border-gold-600/12 bg-surface p-3 shadow-(--shadow-depth-1)">
      <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
        <ShieldCheck aria-hidden className="h-3 w-3 text-gold-600" /> Safety
      </p>
      <div className="mt-1">
        <SafetyBadge score={safety.score} grade={safety.grade} />
      </div>
      <p className="mt-1 text-[10px] text-muted">{safety.radiusKm}km radius</p>
    </div>
  );
}

function CountTile({ count }: { count: number }) {
  return (
    <div className="rounded-2xl border border-gold-600/12 bg-surface p-3 shadow-(--shadow-depth-1)">
      <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
        <MapPin aria-hidden className="h-3 w-3 text-gold-600" /> Places
      </p>
      <p className="mt-1 font-mono text-sm text-surface-foreground">{count}</p>
      <p className="text-[10px] text-muted">nearest first</p>
    </div>
  );
}
