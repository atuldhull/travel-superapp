/**
 * V.UX.20 — food-crawl planner for the foodie persona. The user
 * pastes 2..5 eatery ids (manual entry in v1; a city-eatery picker
 * lands in a follow-up slice once the federated-eatery ingest is
 * wired through) and we render the walking-optimised order plus
 * total walking time.
 *
 * Auth-gated; only the trip owner can build a crawl.
 *
 * Installed by prompt [V.UX.20].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Footprints, MapPin, UtensilsCrossed } from 'lucide-react';
import {
  useFoodCrawlControllerBuild,
  type BuildFoodCrawlRequestDto,
  type BuildFoodCrawlResponseDto,
  type FoodCrawlStopDto,
} from '@app/sdk';
import { Button } from '../../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function FoodCrawlPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  const [eateryIds, setEateryIds] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState<BuildFoodCrawlResponseDto | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const mutation = useFoodCrawlControllerBuild({
    mutation: {
      onSuccess: (resp: { data?: unknown }) => {
        setPlan(resp.data as BuildFoodCrawlResponseDto);
        setErrMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Crawl failed.'}`);
        setPlan(null);
      },
    },
  });

  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrMsg(null);
    const ids = eateryIds
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (ids.length < 2 || ids.length > 5) {
      setErrMsg('Pick 2–5 eateries (one id per line, or comma-separated).');
      return;
    }
    const data: BuildFoodCrawlRequestDto = { eateryIds: ids };
    mutation.mutate({ tripId, data });
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
    <main className="space-y-8">
      <Link
        href={`/trips/${tripId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to trip
      </Link>

      {/* Cinematic royal header band — matches /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <UtensilsCrossed aria-hidden className="h-3.5 w-3.5" /> Foodie route
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Food crawl planner
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Pick 2–5 eateries; we&apos;ll order them for the shortest walk between bites. The first id
          in your list anchors the crawl.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Build your crawl</CardTitle>
          <CardSubtitle>
            One id per line, or comma-separated. You can copy ids from the eatery detail page URL.
          </CardSubtitle>
        </CardHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1">
            <span className="block text-sm font-medium text-surface-foreground">
              Eatery ids (one per line)
            </span>
            <textarea
              value={eateryIds}
              onChange={(e) => setEateryIds(e.target.value)}
              rows={5}
              placeholder="cl0first…
cl0second…
cl0third…"
              className="block w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 font-mono text-xs text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              required
            />
            <span className="block text-xs text-muted">
              You can copy ids from the eatery detail page URL.
            </span>
          </label>
          {errMsg ? <p className="text-sm text-danger">{errMsg}</p> : null}
          <Button type="submit" variant="royal" disabled={mutation.isPending}>
            <UtensilsCrossed aria-hidden className="mr-1.5 h-4 w-4" />
            {mutation.isPending ? 'Optimising…' : 'Build crawl'}
          </Button>
        </form>
      </Card>

      {plan ? (
        <Card depth="raised">
          <CardHeader>
            <CardTitle className="font-display text-xl">Walking-optimised order</CardTitle>
            <CardSubtitle>
              {plan.stops.length} stops · {Math.round(plan.totalDistanceMeters)} m total ·{' '}
              {formatDuration(plan.totalWalkingSeconds)} walking time.
            </CardSubtitle>
          </CardHeader>
          <ol className="space-y-3">
            {plan.stops.map((s: FoodCrawlStopDto) => (
              <li
                key={s.eateryId}
                className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-semibold tracking-tight text-surface-foreground">
                    {s.position}.{' '}
                    <Link
                      href={`/eateries/${s.eateryId}`}
                      className="rounded outline-none transition hover:text-gold-700 focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-gold-300"
                    >
                      {s.eateryId}
                    </Link>
                  </span>
                  {s.position > 1 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Footprints aria-hidden className="h-3.5 w-3.5" />{' '}
                      {Math.round(s.distanceMetersFromPrev)} m ·{' '}
                      {formatDuration(s.walkingSecondsFromPrev)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gold-600 dark:text-gold-300">
                      <MapPin aria-hidden className="h-3.5 w-3.5" /> anchor
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </main>
  );
}

function formatDuration(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
