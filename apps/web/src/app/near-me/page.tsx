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
 * Installed by prompt [V.UX.7].
 */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  useNearMeControllerNearMe,
  type NearMeNowRequestDto,
  type NearMeNowResponseDto,
} from '@app/sdk';
import { Badge } from '../../components/ui/badge';
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

  return (
    <main className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Near me — right now</h1>
        <p className="text-sm text-muted">
          One tap. Five places, one weather glance, a safety read. No sign-in.
        </p>
      </header>

      <div className="rounded-2xl border border-brand/30 bg-linear-to-br from-brand/10 via-transparent to-brand/5 p-5 text-center">
        <Button
          type="button"
          onClick={fetchNearMe}
          disabled={busy || nearMeMutation.isPending}
          className="px-6 py-3 text-base"
        >
          {busy ? 'Locating…' : nearMeMutation.isPending ? 'Searching…' : '📍 Near me'}
        </Button>
        {coords ? (
          <p className="mt-2 font-mono text-[11px] text-muted">
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={voiceQuery}
          onChange={(e) => setVoiceQuery(e.target.value)}
          placeholder='Try saying "I want sushi"'
          className="flex-1 rounded-md border border-muted/30 bg-surface px-3 py-2 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startVoice}
          disabled={voiceListening}
        >
          {voiceListening ? '🎤 Listening…' : '🎤 Speak'}
        </Button>
      </div>

      {errMsg ? (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errMsg}
        </p>
      ) : null}

      {stale ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Showing cached results from {new Date(stale.fetchedAt).toLocaleTimeString()}. Tap{' '}
          <strong>Near me</strong> to refresh.
        </p>
      ) : null}

      {response ? (
        <>
          <Card>
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
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <WeatherTile weather={response.weather} />
              <SafetyTile safety={response.safety} />
              <CountTile count={response.places.length} />
            </div>
          </Card>

          {response.places.length === 0 ? (
            <p className="text-sm text-muted">
              No places nearby in our catalog yet — try widening the search later.
            </p>
          ) : (
            <ul className="space-y-2">
              {response.places.map((p) => (
                <PlaceCard key={p.id} place={p} />
              ))}
            </ul>
          )}
        </>
      ) : null}

      <div className="text-center">
        <Link href="/" className="text-xs text-muted hover:underline">
          ← Back home
        </Link>
      </div>
    </main>
  );
}

function WeatherTile({ weather }: { weather: NearMeNowResponseDto['weather'] }) {
  const today = weather.days[0];
  return (
    <div className="rounded-md border border-muted/15 bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">Weather</p>
      {today ? (
        <p className="mt-1 font-mono text-sm">
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
  const variant: 'brand' | 'neutral' = safety.score >= 75 ? 'brand' : 'neutral';
  return (
    <div className="rounded-md border border-muted/15 bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">Safety</p>
      <p className="mt-1 font-mono text-sm">
        {safety.score}/100 <Badge variant={variant}>{safety.grade}</Badge>
      </p>
      <p className="text-[10px] text-muted">{safety.radiusKm}km radius</p>
    </div>
  );
}

function CountTile({ count }: { count: number }) {
  return (
    <div className="rounded-md border border-muted/15 bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">Places</p>
      <p className="mt-1 font-mono text-sm">{count}</p>
      <p className="text-[10px] text-muted">nearest first</p>
    </div>
  );
}
