/**
 * Create-review surface — `/reviews/new`.
 *
 * The C0 audit flagged this gap: the social loop was read-only, with
 * no anywhere to CREATE a review. This page is the standalone surface
 * any detail page (eatery / stay / agent / place) can link to via
 * `?targetType=...&targetId=...&tripId=...&hint=<display-name>`.
 *
 * Deep-linkable so notifications + emails + share-links can hit it,
 * and mobile can deep-link in. Detail-page embedding of the same
 * `<RatingPicker>` + `<form>` happens as a follow-up (the component
 * surface in this file stays page-private until then).
 *
 * Auth-gated identically to the rest of the authenticated tree:
 * silent-refresh boot completes first, then bounce to /login if no
 * token.
 *
 * Installed by [S-Cr] of the S-series real-functionality closeout.
 */
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PenLine, Star } from 'lucide-react';
import { useReviewsControllerCreate, type CreateReviewRequestDto } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

// Shared gold-tokened field styling so the textarea reads as part of
// the v2 ("Fusion") set (mirrors /stays' FIELD const, scaled up).
const TEXTAREA =
  'mt-1 w-full rounded-xl border border-gold-600/25 bg-surface px-3.5 py-2.5 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25';

// Mirror of the SDK's `CreateReviewRequestDtoTargetType` const. The SDK
// barrel doesn't re-export the schema const (orval emits it but the
// `@app/sdk/src/index.ts` barrel is type-only for schemas) — declaring
// the union locally keeps the page typed without a deep import path.
type TargetType = 'place' | 'stay' | 'eatery' | 'agent';

const TARGET_LABELS: Record<TargetType, string> = {
  place: 'Place',
  stay: 'Stay',
  eatery: 'Eatery',
  agent: 'Agent',
};

const TARGET_TYPES: readonly TargetType[] = ['place', 'stay', 'eatery', 'agent'];

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function NewReviewPage() {
  return (
    <Suspense fallback={null}>
      <NewReviewPageInner />
    </Suspense>
  );
}

function NewReviewPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  // Pre-fill from the query string when present — every detail page
  // that links here passes `?targetType=&targetId=` (and optionally
  // `&tripId=` + `&hint=Display Name`).
  const queryTargetType = params?.get('targetType') ?? '';
  const queryTargetId = params?.get('targetId') ?? '';
  const queryTripId = params?.get('tripId') ?? '';
  const queryHint = params?.get('hint') ?? '';

  const [targetType, setTargetType] = useState<TargetType>(
    isTargetType(queryTargetType) ? queryTargetType : 'place',
  );
  const [targetId, setTargetId] = useState(queryTargetId);
  const [tripId, setTripId] = useState(queryTripId);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useReviewsControllerCreate({
    mutation: {
      onSuccess: () => {
        // There is no standalone "your reviews" list route, so land the
        // user back on what they reviewed when it has a detail page
        // (only eateries do); otherwise return home.
        if (targetType === 'eatery' && targetId.trim().length > 0) {
          router.push(`/eateries/${targetId.trim()}` as never);
        } else {
          router.push('/home');
        }
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Could not submit review.'}`,
        );
      },
    },
  });

  // Hooks must run on every render — keep this above the early returns
  // so the hook count stays stable when auth resolves (null → token).
  const canSubmit = useMemo(
    () => targetId.trim().length > 0 && body.trim().length >= 10 && rating >= 1 && rating <= 5,
    [targetId, body, rating],
  );

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

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorMsg(null);
    const data: CreateReviewRequestDto = {
      targetType: targetType as CreateReviewRequestDto['targetType'],
      targetId: targetId.trim(),
      rating,
      body: body.trim(),
      ...(tripId.trim()
        ? { tripId: tripId.trim() as unknown as CreateReviewRequestDto['tripId'] }
        : {}),
    };
    createMutation.mutate({ data });
  }

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
          <PenLine aria-hidden className="h-3.5 w-3.5" /> Share your take
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Write a review
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Honest. Specific. Reviews shorter than 10 characters or in ALL CAPS get auto-flagged —
          write the way you’d describe it to a friend.
        </p>
      </header>

      <p>
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to home
        </Link>
      </p>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">Your review</CardTitle>
          <CardSubtitle>
            Pick what you’re reviewing, drop a rating, and tell the story.
          </CardSubtitle>
        </CardHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-surface-foreground">
              What are you reviewing?
            </p>
            <div className="flex flex-wrap gap-2">
              {TARGET_TYPES.map((t) => {
                const active = targetType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTargetType(t)}
                    className={
                      'rounded-full border px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                      (active
                        ? 'border-gold-600/40 bg-gold-500/15 text-gold-700 shadow-(--shadow-depth-1) dark:text-gold-300'
                        : 'border-gold-600/20 text-muted hover:border-gold-600/35 hover:bg-gold-500/8 hover:text-surface-foreground')
                    }
                  >
                    {TARGET_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <Field
            label={`${TARGET_LABELS[targetType]} id`}
            type="text"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            help={
              queryHint
                ? `You're reviewing: ${queryHint}`
                : 'Paste the id (cuid). Detail pages can link here and pre-fill this field.'
            }
          />

          <Field
            label="Trip context (optional)"
            type="text"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            help="If this review is tied to a trip, paste the trip id so it surfaces on your trip page."
          />

          <div>
            <p className="mb-2 text-sm font-medium text-surface-foreground">Rating</p>
            <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={star === rating}
                    aria-label={`${star} star${star === 1 ? '' : 's'}`}
                    onClick={() => setRating(star)}
                    className={
                      'rounded-md p-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                      (filled ? 'text-gold-500' : 'text-muted/40 hover:text-gold-400')
                    }
                  >
                    <Star
                      aria-hidden
                      className="h-7 w-7"
                      fill={filled ? 'currentColor' : 'none'}
                      strokeWidth={1.75}
                    />
                  </button>
                );
              })}
              <Badge variant="gold" className="ml-2">
                {rating} / 5
              </Badge>
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-surface-foreground"
              htmlFor="review-body"
            >
              Review
            </label>
            <textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              minLength={10}
              maxLength={8000}
              required
              className={TEXTAREA}
              placeholder={
                targetType === 'agent'
                  ? 'How was your experience working with this agent?'
                  : `What stood out about this ${TARGET_LABELS[targetType].toLowerCase()}?`
              }
            />
            <p className="mt-1 text-xs text-muted">
              {body.trim().length} / 8000 characters · minimum 10
            </p>
          </div>

          {errorMsg ? (
            <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}

          <div className="flex gap-3">
            <Button type="submit" variant="royal" disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? 'Submitting…' : 'Submit review'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setBody('');
                setRating(5);
                setErrorMsg(null);
              }}
              disabled={createMutation.isPending}
            >
              Reset
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}

function isTargetType(v: string): v is TargetType {
  return v === 'place' || v === 'stay' || v === 'eatery' || v === 'agent';
}
