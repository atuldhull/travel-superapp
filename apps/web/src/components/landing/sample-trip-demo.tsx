/**
 * Live demo widget on `/`. First-time visitor picks one of the
 * preset cities (or types a custom title), drags the radius slider,
 * and clicks "Generate". The typed `useTripControllerSamplePlan`
 * hook hits the public `/trips/sample-plan` endpoint and renders the
 * prose plan inline. NO signup wall.
 *
 * Cities are baked in client-side so we don't need geocoding for the
 * demo — the user can refine destination later when they sign up
 * and create a real trip.
 *
 * Installed by prompt [V.UX.1].
 */
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';
import {
  useTripControllerSamplePlan,
  type GenerateSamplePlanRequestDto,
  type GenerateSamplePlanResponseDto,
} from '@app/sdk';
import { Button } from '../ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { getRecalledSamplePlan, rememberSamplePlan } from '../../lib/visit-recall';

// WebGL/Leaflet touch `window` — keep both viz out of SSR, lazy.
const loadingBox = (
  <div className="mt-2 h-72 w-full animate-pulse rounded-2xl border border-gold-600/15 bg-gold-500/5" />
);
const JourneyStory = dynamic(
  () => import('./itinerary-storyboard').then((m) => m.ItineraryStoryboard),
  { ssr: false, loading: () => loadingBox },
);
const JourneyGlobe = dynamic(() => import('./itinerary-globe').then((m) => m.ItineraryGlobe), {
  ssr: false,
  loading: () => loadingBox,
});
const JourneyMap = dynamic(
  () => import('./itinerary-journey-map').then((m) => m.ItineraryJourneyMap),
  { ssr: false, loading: () => loadingBox },
);

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

interface CityPreset {
  readonly title: string;
  readonly emoji: string;
  readonly center: { readonly lat: number; readonly lng: number };
}

const CITY_PRESETS: readonly CityPreset[] = [
  { title: 'Goa', emoji: '🏖', center: { lat: 15.2993, lng: 74.124 } },
  { title: 'Rishikesh', emoji: '🧘', center: { lat: 30.0869, lng: 78.2676 } },
  { title: 'Tokyo', emoji: '🗼', center: { lat: 35.6762, lng: 139.6503 } },
  { title: 'Bali', emoji: '🌴', center: { lat: -8.3405, lng: 115.092 } },
  { title: 'Lisbon', emoji: '🚋', center: { lat: 38.7223, lng: -9.1393 } },
  { title: 'Mexico City', emoji: '🌮', center: { lat: 19.4326, lng: -99.1332 } },
];

export function SampleTripDemo() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [radiusKm, setRadiusKm] = useState(25);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<GenerateSamplePlanResponseDto | null>(null);
  /** True when the visible plan was hydrated from localStorage rather than freshly generated. */
  const [fromCache, setFromCache] = useState(false);
  // 'story' = image-led cards + hotels (default — best for a one-city
  // plan; places stay distinct); 'map' = accurate street geo;
  // 'globe' = the cinematic 3D flex. Same geocoded journey.
  const [view, setView] = useState<'story' | 'map' | 'globe'>('story');

  // Hydrate from localStorage on mount — returning visitors see their
  // last plan instantly without re-generation. The matching city is
  // pre-selected so a "Regenerate" click reproduces the same shape.
  useEffect(() => {
    const cached = getRecalledSamplePlan();
    if (!cached) return;
    setPlanResult({
      plan: cached.plan,
      model: cached.model,
      provider: cached.provider ?? 'stub',
    });
    setFromCache(true);
    const idx = CITY_PRESETS.findIndex((c) => c.title === cached.title);
    if (idx >= 0) setSelectedIdx(idx);
  }, []);

  const mutation = useTripControllerSamplePlan({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const result = response.data as GenerateSamplePlanResponseDto;
        setPlanResult(result);
        setFromCache(false);
        setErrorMsg(null);
        // Persist for the next visit (24h TTL via getRecalledSamplePlan).
        const preset = CITY_PRESETS[selectedIdx]!;
        rememberSamplePlan({
          title: preset.title,
          emoji: preset.emoji,
          plan: result.plan,
          model: result.model,
          provider: result.provider,
          cachedAt: Date.now(),
        });
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Generation failed.'}`,
        );
      },
    },
  });

  function generate() {
    setPlanResult(null);
    setErrorMsg(null);
    const preset = CITY_PRESETS[selectedIdx]!;
    const data: GenerateSamplePlanRequestDto = {
      title: preset.title,
      center: preset.center,
      radiusKm,
    };
    mutation.mutate({ data });
  }

  const selected = CITY_PRESETS[selectedIdx]!;

  return (
    <section
      id="sample-trip"
      className="rounded-3xl border border-gold-600/15 bg-surface px-6 py-8 shadow-(--shadow-depth-1) sm:px-10 sm:py-12"
    >
      <header className="mb-6 max-w-2xl space-y-2">
        <p className="inline-flex items-center gap-2 rounded-full border border-gold-600/25 bg-gold-500/8 px-3 py-1 text-xs font-medium tracking-wide text-gold-700 dark:text-gold-300">
          Live demo
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-surface-foreground sm:text-4xl">
          Try it without signing up
        </h2>
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          Pick a city, set your radius, get a 3-day AI itinerary in seconds. No account needed.
        </p>
      </header>
      <div className="space-y-8">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
              Where to?
            </label>
            <div className="flex flex-wrap gap-2">
              {CITY_PRESETS.map((c, i) => {
                const active = i === selectedIdx;
                return (
                  <button
                    key={c.title}
                    type="button"
                    onClick={() => setSelectedIdx(i)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active
                        ? 'border-gold-600/40 bg-gold-500/15 font-medium text-surface-foreground shadow-(--shadow-depth-1)'
                        : 'border-gold-600/15 text-muted hover:bg-gold-500/5 hover:text-surface-foreground'
                    }`}
                  >
                    <span aria-hidden>{c.emoji}</span> {c.title}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label
              htmlFor="sample-radius"
              className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted"
            >
              <span>Radius</span>
              <span className="font-mono text-gold-700 dark:text-gold-300">{radiusKm} km</span>
            </label>
            <input
              id="sample-radius"
              type="range"
              min={5}
              max={100}
              step={5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-gold-600"
            />
          </div>
          <Button
            type="button"
            variant="royal"
            onClick={generate}
            disabled={mutation.isPending}
            className="w-full sm:w-auto"
          >
            {mutation.isPending ? 'Generating…' : `✨ Plan ${selected.title} for me`}
          </Button>
          {errorMsg ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </p>
          ) : null}
        </div>
        <div>
          {mutation.isPending ? (
            <Card>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-5/6" />
              <Skeleton className="mt-1 h-3 w-4/6" />
              <Skeleton className="mt-1 h-3 w-3/6" />
            </Card>
          ) : planResult ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span aria-hidden className="mr-1.5">
                    {selected.emoji}
                  </span>
                  Your sample {selected.title} plan
                </CardTitle>
                <CardSubtitle>
                  Powered by <code className="font-mono text-[11px]">{planResult.model}</code> ·{' '}
                  {fromCache ? (
                    <span className="text-gold-700 dark:text-gold-300">From your last visit</span>
                  ) : (
                    <span>No account needed</span>
                  )}
                </CardSubtitle>
              </CardHeader>
              <div className="mt-3 inline-flex rounded-full border border-gold-600/20 bg-surface p-0.5 text-xs">
                {(
                  [
                    ['story', '✨ Story'],
                    ['map', '🗺️ Map'],
                    ['globe', '🌍 Globe'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={
                      'rounded-full px-3 py-1 font-medium transition ' +
                      (view === v
                        ? 'text-brand-900 shadow-(--shadow-depth-1)'
                        : 'text-muted hover:text-surface-foreground')
                    }
                    style={view === v ? { backgroundImage: 'var(--gradient-gold)' } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {view === 'story' ? (
                <JourneyStory
                  plan={planResult.plan}
                  city={selected.title}
                  center={selected.center}
                  className="mt-4"
                />
              ) : view === 'globe' ? (
                <JourneyGlobe
                  plan={planResult.plan}
                  city={selected.title}
                  center={selected.center}
                  className="mt-3 h-115 w-full sm:h-140"
                />
              ) : (
                <JourneyMap
                  plan={planResult.plan}
                  city={selected.title}
                  center={selected.center}
                  className="mt-3 h-110 w-full sm:h-130"
                />
              )}
              <details className="mt-3 rounded-xl border border-gold-600/12 bg-gold-500/5">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-surface-foreground transition hover:text-gold-700 dark:hover:text-gold-300">
                  📖 Read the written plan
                </summary>
                <div className="max-h-96 space-y-3 overflow-auto px-4 pb-4 text-sm leading-relaxed text-surface-foreground/90">
                  {planResult.plan
                    .split(/\n{2,}/)
                    .map((para) => para.trim())
                    .filter(Boolean)
                    .map((para, i) => {
                      const m = para.match(/^(Day\s*\d+)\s*[—–-]\s*([\s\S]*)$/);
                      return m ? (
                        <p key={i}>
                          <span className="font-display font-semibold text-gold-700 dark:text-gold-300">
                            {m[1]}
                          </span>{' '}
                          — {m[2]}
                        </p>
                      ) : (
                        <p key={i}>{para}</p>
                      );
                    })}
                </div>
              </details>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold text-brand-900 shadow-(--shadow-depth-1) transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{ backgroundImage: 'var(--gradient-gold)' }}
                >
                  Save this trip — sign up free →
                </Link>
                <button
                  type="button"
                  onClick={generate}
                  className="text-sm text-muted hover:underline"
                  disabled={mutation.isPending}
                >
                  Regenerate
                </button>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Your plan will appear here</CardTitle>
                <CardSubtitle>
                  Pick a city and click <strong>Plan for me</strong> — we'll do the rest.
                </CardSubtitle>
              </CardHeader>
              <p className="text-sm leading-relaxed text-muted">
                The AI considers your destination + radius and drafts a 3-day itinerary with must-do
                places, food spots, and pacing notes. Try a different city to compare.
              </p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
