/**
 * /me/agent — agent self-profile + dashboard.
 *
 * Closes C0's agent-60% gap (no edit / dashboard for the agent's own
 * profile). Three SDK hooks (`useAgentSelfControllerMe`,
 * `useAgentSelfControllerUpdate`, `useAgentSelfControllerDashboard`)
 * existed unused; this page wires all three.
 *
 * Surface:
 *   - Profile edit (displayName / bio / languages CSV / regions CSV).
 *   - KYC status badge — pending / verified / rejected, set by admin
 *     out-of-band (V.UX.36 admin queue verifies; a [BLOCKED] note
 *     points to E5 for the queue UI itself).
 *   - Dashboard: bookings (escrow state) + earnings + recent reviews
 *     over a configurable window (default 30 days).
 *
 * Auth-gated. Non-agent users (KYC pending or no profile) see a
 * "request KYC" link out — the agent-onboarding flow itself is a
 * follow-up (operator-owed).
 *
 * Installed by [S-Cas] of the S-series real-functionality closeout.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  getAgentSelfControllerMeQueryKey,
  useAgentSelfControllerDashboard,
  useAgentSelfControllerMe,
  useAgentSelfControllerUpdate,
  type AgentBookingSummaryDto,
  type AgentDashboardDto,
  type AgentProfileDto,
  type AgentReviewWithResponseDto,
  type UpdateAgentProfileRequestDto,
} from '@app/sdk';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

type KycStatus = 'pending' | 'verified' | 'rejected';

const KYC_TONE: Record<KycStatus, string> = {
  pending: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  verified: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  rejected: 'border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-400',
};

export default function AgentSelfPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const [windowDays, setWindowDays] = useState(30);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login?next=/me/agent');
  }, [bootComplete, token, router]);

  const meQuery = useAgentSelfControllerMe({ query: { enabled: token !== null } });
  const dashboardQuery = useAgentSelfControllerDashboard(
    { windowDays: String(windowDays) as unknown as never },
    { query: { enabled: token !== null && (meQuery.data?.data as unknown) !== null } },
  );

  if (!bootComplete)
    return (
      <main>
        <p className="text-muted">Restoring session…</p>
      </main>
    );
  if (token === null)
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );

  if (meQuery.isLoading) {
    return (
      <main className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32" />
      </main>
    );
  }

  // The api returns `{ data: null }` when the caller has no agent
  // profile — orval types the data field as the DTO, so we widen.
  const profile = (meQuery.data?.data as unknown as AgentProfileDto | null) ?? null;

  if (meQuery.isError && (meQuery.error as ApiError)?.status !== 404) {
    return (
      <main className="space-y-4">
        <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          Couldn't load your agent profile —{' '}
          {(meQuery.error as ApiError)?.code ??
            `HTTP_${(meQuery.error as ApiError)?.status ?? '???'}`}
          .
        </p>
      </main>
    );
  }

  if (profile === null) {
    return (
      <main className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Agent profile</h1>
          <p className="text-sm text-muted">
            You don't have an agent profile yet. Agents help travellers plan complex trips and earn
            commission on bookings.
          </p>
        </header>
        <Card>
          <p className="text-sm text-muted">
            Agent onboarding is currently operator-owned. Email{' '}
            <a href="mailto:agents@travel.local" className="text-brand hover:underline">
              agents@travel.local
            </a>{' '}
            to start the KYC process. Approval lands in the admin queue (E5).
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <Link href="/account" className="text-xs text-muted underline-offset-2 hover:underline">
          ← Account
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Agent profile</h1>
        <p className="text-sm text-muted">
          Manage your public profile + see live booking and review activity.
        </p>
      </header>

      <ProfileSection profile={profile} />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Dashboard</CardTitle>
              <CardSubtitle>Last {windowDays} days.</CardSubtitle>
            </div>
            <label className="text-xs text-muted">
              Window
              <select
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value))}
                className="ml-2 rounded-md border border-muted/30 bg-surface px-2 py-1 text-xs"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </select>
            </label>
          </div>
        </CardHeader>
        <DashboardBody query={dashboardQuery} />
      </Card>
    </main>
  );
}

function ProfileSection({ profile }: { profile: AgentProfileDto }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState((profile.bio as unknown as string | null) ?? '');
  const [languages, setLanguages] = useState(profile.languages.join(', '));
  const [regions, setRegions] = useState(profile.regions.join(', '));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const update = useAgentSelfControllerUpdate({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getAgentSelfControllerMeQueryKey() });
        setEditing(false);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Could not save profile.'}`,
        );
      },
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data: UpdateAgentProfileRequestDto = {};
    if (displayName !== profile.displayName) data.displayName = displayName;
    const cleanBio = bio.trim();
    const currentBio = ((profile.bio as unknown as string | null) ?? '').trim();
    if (cleanBio !== currentBio) {
      data.bio = (cleanBio === ''
        ? null
        : cleanBio) as unknown as UpdateAgentProfileRequestDto['bio'];
    }
    const langs = csvList(languages);
    if (!arrayEquals(langs, profile.languages)) data.languages = langs;
    const regs = csvList(regions);
    if (!arrayEquals(regs, profile.regions)) data.regions = regs;
    if (Object.keys(data).length === 0) {
      setEditing(false);
      return;
    }
    update.mutate({ data });
  }

  const kycStatus = profile.kycStatus as unknown as KycStatus;
  const verifiedAt = profile.verifiedAt as unknown as string | null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{profile.displayName}</CardTitle>
            <CardSubtitle>
              <span
                className={
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ' +
                  KYC_TONE[kycStatus]
                }
              >
                KYC {kycStatus}
              </span>
              {verifiedAt ? ` · verified ${new Date(verifiedAt).toLocaleDateString()}` : ''} · ★{' '}
              {profile.ratingAverage.toFixed(1)} ({profile.ratingCount})
            </CardSubtitle>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
        </div>
      </CardHeader>
      {editing ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-muted">
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-md border border-muted/30 bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            Bio (≤2000 chars; blank to clear)
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded-md border border-muted/30 bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            Languages (CSV — e.g. en, fr, ja)
            <input
              type="text"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="mt-1 w-full rounded-md border border-muted/30 bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            Regions (CSV — e.g. southeast-asia, alps, west-africa)
            <input
              type="text"
              value={regions}
              onChange={(e) => setRegions(e.target.value)}
              className="mt-1 w-full rounded-md border border-muted/30 bg-surface px-2 py-1 text-sm"
            />
          </label>
          {errorMsg ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setErrorMsg(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-2 text-sm">
          {(profile.bio as unknown as string | null) ? (
            <p className="whitespace-pre-wrap">{profile.bio as unknown as string}</p>
          ) : (
            <p className="text-muted">No bio yet.</p>
          )}
          <p className="flex flex-wrap gap-1">
            {profile.languages.map((l) => (
              <Badge key={l} variant="neutral">
                {l}
              </Badge>
            ))}
            {profile.languages.length === 0 ? <Badge variant="neutral">no languages</Badge> : null}
          </p>
          <p className="flex flex-wrap gap-1">
            {profile.regions.map((r) => (
              <Badge key={r} variant="neutral">
                {r}
              </Badge>
            ))}
            {profile.regions.length === 0 ? <Badge variant="neutral">no regions</Badge> : null}
          </p>
        </div>
      )}
    </Card>
  );
}

function DashboardBody({ query }: { query: ReturnType<typeof useAgentSelfControllerDashboard> }) {
  if (query.isLoading) return <Skeleton className="h-20" count={3} />;
  if (query.isError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn't load dashboard — {(query.error as ApiError)?.code ?? 'HTTP_???'}.
      </p>
    );
  }
  const body = query.data?.data as unknown as AgentDashboardDto | undefined;
  if (!body) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <div className="space-y-4">
      <EarningsRow grossUsd={body.earnings.grossUsd} bookingsCount={body.earnings.bookingsCount} />
      <BookingsList bookings={body.bookings} />
      <ReviewsList reviews={body.reviews} />
    </div>
  );
}

function EarningsRow({ grossUsd, bookingsCount }: { grossUsd: string; bookingsCount: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-md border border-muted/15 bg-surface p-3">
        <p className="text-xs text-muted">Gross earnings (USD)</p>
        <p className="mt-1 text-2xl font-bold">${grossUsd}</p>
      </article>
      <article className="rounded-md border border-muted/15 bg-surface p-3">
        <p className="text-xs text-muted">Bookings</p>
        <p className="mt-1 text-2xl font-bold">{bookingsCount}</p>
      </article>
    </div>
  );
}

function BookingsList({ bookings }: { bookings: readonly AgentBookingSummaryDto[] }) {
  if (bookings.length === 0) {
    return <p className="text-sm text-muted">No bookings in this window.</p>;
  }
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">Bookings</h3>
      <ul className="space-y-1">
        {bookings.slice(0, 10).map((b) => (
          <li
            key={b.id}
            className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-md border border-muted/10 bg-surface px-3 py-1.5 text-xs"
          >
            <span className="font-mono text-[10px] text-muted">{b.id.slice(0, 8)}…</span>
            <Badge variant="neutral">{b.state}</Badge>
            <span className="text-muted">held {new Date(b.heldAt).toLocaleDateString()}</span>
            <span className="font-medium">${b.amountUsd}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewsList({ reviews }: { reviews: readonly AgentReviewWithResponseDto[] }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted">No reviews in this window.</p>;
  }
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">Recent reviews</h3>
      <ul className="space-y-1">
        {reviews.slice(0, 5).map((r) => {
          const rev = (
            r as unknown as {
              review: { id: string; rating: number; body: string; createdAt: string };
            }
          ).review;
          return (
            <li
              key={rev.id}
              className="rounded-md border border-muted/10 bg-surface px-3 py-1.5 text-xs"
            >
              <p>
                <span className="text-amber-500">{'★'.repeat(rev.rating)}</span>{' '}
                <span className="text-muted">{new Date(rev.createdAt).toLocaleDateString()}</span>
              </p>
              <p className="mt-1 line-clamp-2">{rev.body}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function csvList(s: string): string[] {
  return s
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function arrayEquals(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
