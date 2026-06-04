/**
 * V.UX.24 — agent dashboard. One composite GET surfaces the
 * profile (with KYC badge), bookings list, gross-earnings sum, and
 * recent reviews. Each review row carries an inline "Respond"
 * editor that POSTs to `/reviews/:id/response` and refetches.
 *
 * Auth-gated like the rest of the caller-self pages. Non-agent
 * roles get a friendly redirect instead of the raw 403 banner.
 *
 * Installed by prompt [V.UX.24].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CalendarDays, Languages, MapPin, Pencil, Star, Wallet } from 'lucide-react';
import {
  getAgentSelfControllerDashboardQueryKey,
  useAgentSelfControllerDashboard,
  useReviewsControllerRespond,
  type AgentDashboardDto,
  type AgentReviewWithResponseDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function AgentDashboardPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useAgentSelfControllerDashboard(undefined, {
    query: { enabled: token !== null, retry: false },
  });

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

  const apiErr = error as ApiError | null;
  const body = data?.data as unknown as AgentDashboardDto | undefined;
  const roleForbidden = apiErr?.code === 'ROLE_FORBIDDEN' || apiErr?.status === 403;
  const noProfile = apiErr?.code === 'AGENT_PROFILE_NOT_FOUND';

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <BadgeCheck aria-hidden className="h-3.5 w-3.5" /> Your agent hub
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Agent dashboard
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Bookings, earnings, and reviews from the last 30 days. Respond to reviews inline.
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Link
            href="/agent/profile"
            className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-white/5 px-4 py-2 text-sm font-medium text-gold-300 backdrop-blur-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          >
            <Pencil aria-hidden className="h-3.5 w-3.5" /> Edit profile
          </Link>
          <Link
            href="/agent/bookings"
            className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-white/5 px-4 py-2 text-sm font-medium text-gold-300 backdrop-blur-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          >
            <CalendarDays aria-hidden className="h-3.5 w-3.5" /> Bookings list
          </Link>
        </div>
      </header>

      {isLoading ? (
        <Card depth="raised">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </Card>
      ) : roleForbidden ? (
        <Card depth="raised">
          <p className="text-sm text-danger">
            This page is for verified agents. If you believe you should have access, contact
            support.
          </p>
        </Card>
      ) : noProfile ? (
        <Card depth="raised">
          <p className="text-sm text-muted">
            Your agent profile hasn&apos;t been provisioned yet. Once an admin onboards you, this
            dashboard will surface bookings + earnings + reviews.
          </p>
        </Card>
      ) : isError ? (
        <Card depth="raised">
          <p className="text-sm text-danger">
            Couldn&apos;t load the dashboard ({apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).
          </p>
        </Card>
      ) : body ? (
        <>
          <ProfileSummaryCard profile={body.profile} />
          <EarningsCard windowDays={body.windowDays} body={body} />
          <BookingsCard bookings={body.bookings} />
          <ReviewsCard reviews={body.reviews} />
        </>
      ) : null}
    </main>
  );
}

function ProfileSummaryCard({ profile }: { profile: AgentDashboardDto['profile'] }) {
  const verified = profile.kycStatus === 'verified';
  return (
    <Card depth="raised">
      <CardHeader>
        <CardTitle>{profile.displayName}</CardTitle>
        <CardSubtitle className="flex flex-wrap items-center gap-2">
          {verified ? (
            <Badge variant="success">
              <BadgeCheck aria-hidden className="mr-1 h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="neutral">{profile.kycStatus}</Badge>
          )}
          <span className="inline-flex items-center gap-1 font-mono text-xs text-muted">
            <Star aria-hidden className="h-3 w-3 text-gold-500" />{' '}
            {profile.ratingAverage.toFixed(1)} ({profile.ratingCount})
          </span>
        </CardSubtitle>
      </CardHeader>
      {profile.bio ? (
        <p className="text-sm text-muted">{profile.bio as unknown as string}</p>
      ) : null}
      <p className="mt-2 flex flex-wrap gap-1 text-xs">
        {profile.languages.map((l) => (
          <Badge key={`lang-${l}`} variant="neutral">
            <Languages aria-hidden className="mr-1 h-3 w-3" /> {l}
          </Badge>
        ))}
        {profile.regions.map((r) => (
          <Badge key={`reg-${r}`} variant="gold">
            <MapPin aria-hidden className="mr-1 h-3 w-3" /> {r}
          </Badge>
        ))}
      </p>
    </Card>
  );
}

function EarningsCard({ windowDays, body }: { windowDays: number; body: AgentDashboardDto }) {
  return (
    <Card depth="raised">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet aria-hidden className="h-5 w-5 text-gold-600" /> Gross earnings (last {windowDays}{' '}
          days)
        </CardTitle>
        <CardSubtitle>
          Sum of held + released escrow holds. Refunded holds are excluded.
        </CardSubtitle>
      </CardHeader>
      <p className="font-display text-3xl font-semibold tracking-tight text-gold-700 dark:text-gold-300">
        ${body.earnings.grossUsd}
      </p>
      <p className="text-xs text-muted">
        {body.earnings.bookingsCount} booking{body.earnings.bookingsCount === 1 ? '' : 's'}.
      </p>
    </Card>
  );
}

function BookingsCard({ bookings }: { bookings: AgentDashboardDto['bookings'] }) {
  return (
    <Card depth="raised">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays aria-hidden className="h-5 w-5 text-gold-600" /> Bookings
        </CardTitle>
        <CardSubtitle>Most recent first.</CardSubtitle>
      </CardHeader>
      {bookings.length === 0 ? (
        <p className="text-sm text-muted">No bookings in this window yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
            >
              <span className="font-mono text-xs text-muted">
                {new Date(b.heldAt).toLocaleDateString()}
              </span>
              <span className="font-display font-semibold tracking-tight">${b.amountUsd}</span>
              <Badge variant={b.state === 'released' ? 'success' : 'neutral'}>{b.state}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReviewsCard({ reviews }: { reviews: readonly AgentReviewWithResponseDto[] }) {
  return (
    <Card depth="raised">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star aria-hidden className="h-5 w-5 text-gold-600" /> Recent reviews
        </CardTitle>
        <CardSubtitle>Respond inline. Replies are one-shot — pick your words.</CardSubtitle>
      </CardHeader>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted">No reviews yet.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReviewRow({ review }: { review: AgentReviewWithResponseDto }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const respond = useReviewsControllerRespond({
    mutation: {
      onSuccess: async () => {
        setErrMsg(null);
        setEditing(false);
        setDraft('');
        await queryClient.invalidateQueries({
          queryKey: getAgentSelfControllerDashboardQueryKey(),
        });
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Reply failed.'}`);
      },
    },
  });

  return (
    <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-mono">{new Date(review.createdAt).toLocaleDateString()}</span>
        <span className="inline-flex items-center gap-1">
          <Star aria-hidden className="h-3 w-3 text-gold-500" /> {review.rating}/5
        </span>
        {review.verifiedBooking ? <Badge variant="gold">verified booking</Badge> : null}
      </p>
      <p className="mt-1 leading-relaxed">{review.body}</p>
      {review.responseBody ? (
        <p className="mt-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
          <span className="font-semibold">Your reply</span>{' '}
          {review.responseAt ? (
            <span className="text-muted">
              · {new Date(review.responseAt as unknown as string).toLocaleDateString()}
            </span>
          ) : null}
          <br />
          {review.responseBody as unknown as string}
        </p>
      ) : editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Type a reply (one-shot — saved as written)…"
            className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="royal"
              size="sm"
              onClick={() => respond.mutate({ id: review.id, data: { responseBody: draft } })}
              disabled={respond.isPending || draft.trim().length === 0}
            >
              {respond.isPending ? 'Saving…' : 'Reply'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft('');
                setErrMsg(null);
              }}
            >
              Cancel
            </Button>
            {errMsg ? <span className="text-xs text-danger">{errMsg}</span> : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gold-700 transition hover:text-gold-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-gold-300"
        >
          Respond →
        </button>
      )}
    </li>
  );
}
