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
    <main className="space-y-6">
      <p>
        <Link href={`/trips/${tripId}`} className="text-sm text-muted hover:underline">
          ← Back to trip
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>🍜 Food crawl planner</CardTitle>
          <CardSubtitle>
            Pick 2–5 eateries; we&apos;ll order them for the shortest walk between bites. The first
            id in your list anchors the crawl.
          </CardSubtitle>
        </CardHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1">
            <span className="block text-sm font-medium">Eatery ids (one per line)</span>
            <textarea
              value={eateryIds}
              onChange={(e) => setEateryIds(e.target.value)}
              rows={5}
              placeholder="cl0first…
cl0second…
cl0third…"
              className="block w-full rounded-md border border-muted/30 bg-surface px-3 py-2 font-mono text-xs"
              required
            />
            <span className="block text-xs text-muted">
              You can copy ids from the eatery detail page URL.
            </span>
          </label>
          {errMsg ? <p className="text-sm text-danger">{errMsg}</p> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Optimising…' : '🍽️ Build crawl'}
          </Button>
        </form>
      </Card>

      {plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Walking-optimised order</CardTitle>
            <CardSubtitle>
              {plan.stops.length} stops · {Math.round(plan.totalDistanceMeters)} m total ·{' '}
              {formatDuration(plan.totalWalkingSeconds)} walking time.
            </CardSubtitle>
          </CardHeader>
          <ol className="space-y-2">
            {plan.stops.map((s: FoodCrawlStopDto) => (
              <li
                key={s.eateryId}
                className="rounded-md border border-muted/20 bg-surface p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {s.position}.{' '}
                    <Link href={`/eateries/${s.eateryId}`} className="text-brand hover:underline">
                      {s.eateryId}
                    </Link>
                  </span>
                  {s.position > 1 ? (
                    <span className="text-xs text-muted">
                      🚶 {Math.round(s.distanceMetersFromPrev)} m ·{' '}
                      {formatDuration(s.walkingSecondsFromPrev)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">📍 anchor</span>
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
