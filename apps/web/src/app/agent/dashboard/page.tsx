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
import {
  getAgentSelfControllerDashboardQueryKey,
  useAgentSelfControllerDashboard,
  useReviewsControllerRespond,
  type AgentDashboardDto,
  type AgentReviewWithResponseDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
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
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>👤 Agent dashboard</CardTitle>
          <CardSubtitle>
            Bookings, earnings, and reviews from the last 30 days. Respond to reviews inline.
          </CardSubtitle>
        </CardHeader>
        <p className="flex flex-wrap gap-3 text-sm">
          <Link href="/agent/profile" className="text-brand hover:underline">
            ✏️ Edit profile
          </Link>
          <Link href="/agent/bookings" className="text-brand hover:underline">
            📅 Bookings list
          </Link>
        </p>
      </Card>

      {isLoading ? (
        <Card>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </Card>
      ) : roleForbidden ? (
        <Card>
          <p className="text-sm text-danger">
            This page is for verified agents. If you believe you should have access, contact
            support.
          </p>
        </Card>
      ) : noProfile ? (
        <Card>
          <p className="text-sm text-muted">
            Your agent profile hasn&apos;t been provisioned yet. Once an admin onboards you, this
            dashboard will surface bookings + earnings + reviews.
          </p>
        </Card>
      ) : isError ? (
        <Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{profile.displayName}</CardTitle>
        <CardSubtitle>
          {verified ? (
            <Badge variant="brand">✓ Verified</Badge>
          ) : (
            <Badge variant="neutral">{profile.kycStatus}</Badge>
          )}
          <span className="ml-2 font-mono text-xs text-muted">
            ★ {profile.ratingAverage.toFixed(1)} ({profile.ratingCount})
          </span>
        </CardSubtitle>
      </CardHeader>
      {profile.bio ? (
        <p className="text-sm text-muted">{profile.bio as unknown as string}</p>
      ) : null}
      <p className="mt-2 flex flex-wrap gap-1 text-xs">
        {profile.languages.map((l) => (
          <Badge key={`lang-${l}`} variant="neutral">
            🗣 {l}
          </Badge>
        ))}
        {profile.regions.map((r) => (
          <Badge key={`reg-${r}`} variant="neutral">
            📍 {r}
          </Badge>
        ))}
      </p>
    </Card>
  );
}

function EarningsCard({ windowDays, body }: { windowDays: number; body: AgentDashboardDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>💵 Gross earnings (last {windowDays} days)</CardTitle>
        <CardSubtitle>
          Sum of held + released escrow holds. Refunded holds are excluded.
        </CardSubtitle>
      </CardHeader>
      <p className="text-3xl font-bold">${body.earnings.grossUsd}</p>
      <p className="text-xs text-muted">
        {body.earnings.bookingsCount} booking{body.earnings.bookingsCount === 1 ? '' : 's'}.
      </p>
    </Card>
  );
}

function BookingsCard({ bookings }: { bookings: AgentDashboardDto['bookings'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📅 Bookings</CardTitle>
        <CardSubtitle>Most recent first.</CardSubtitle>
      </CardHeader>
      {bookings.length === 0 ? (
        <p className="text-sm text-muted">No bookings in this window yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 rounded border border-muted/15 p-2"
            >
              <span className="font-mono text-xs text-muted">
                {new Date(b.heldAt).toLocaleDateString()}
              </span>
              <span className="font-medium">${b.amountUsd}</span>
              <Badge variant={b.state === 'released' ? 'brand' : 'neutral'}>{b.state}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReviewsCard({ reviews }: { reviews: readonly AgentReviewWithResponseDto[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>⭐ Recent reviews</CardTitle>
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
    <li className="rounded border border-muted/15 p-3 text-sm">
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className="font-mono">{new Date(review.createdAt).toLocaleDateString()}</span>
        <span>★ {review.rating}/5</span>
        {review.verifiedBooking ? <Badge variant="brand">verified booking</Badge> : null}
      </p>
      <p className="mt-1 leading-relaxed">{review.body}</p>
      {review.responseBody ? (
        <p className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs">
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
        <div className="mt-2 space-y-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Type a reply (one-shot — saved as written)…"
            className="w-full rounded-md border border-muted/30 bg-transparent px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => respond.mutate({ id: review.id, data: { responseBody: draft } })}
              disabled={respond.isPending || draft.trim().length === 0}
              className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {respond.isPending ? 'Saving…' : 'Reply'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft('');
                setErrMsg(null);
              }}
              className="rounded-md border border-muted/30 px-3 py-1 text-xs hover:bg-muted/10"
            >
              Cancel
            </button>
            {errMsg ? <span className="text-xs text-danger">{errMsg}</span> : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-brand hover:underline"
        >
          Respond →
        </button>
      )}
    </li>
  );
}
