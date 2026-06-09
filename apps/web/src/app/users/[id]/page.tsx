/**
 * V.UX.25 — public reviewer profile page. Renders the
 * KarmaPill (score next to displayName), BadgeShelf, recent
 * reviews, and a "Helpful" button on each review for signed-in
 * viewers (auto-omitted for anonymous + self).
 *
 * Auth-NOT-required for the read; the api endpoint is `@Public()`.
 *
 * Installed by prompt [V.UX.25].
 */
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Star, ThumbsUp, UserCircle } from 'lucide-react';
import {
  getPublicUserProfileControllerProfileQueryKey,
  usePublicUserProfileControllerProfile,
  useReviewsControllerHelpful,
  type PublicReviewerProfileDto,
  type PublicReviewerRecentReviewDto,
} from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { Button } from '../../../components/ui/button';
import { toast } from '../../../components/ui/toast';
import { BadgeShelf } from '../../../components/social/badge-shelf';
import { KarmaPill } from '../../../components/social/karma-pill';
import { useAuthToken } from '../../../lib/use-auth-token';
import {
  getCreatorProfile,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  type CreatorProfile,
} from '../../../lib/two-oh-api';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function PublicReviewerProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? '';
  const token = useAuthToken();
  const { data, isLoading, isError, error } = usePublicUserProfileControllerProfile(userId, {
    query: { enabled: userId !== '', retry: false },
  });

  const apiErr = error as ApiError | null;
  const body = data?.data as unknown as PublicReviewerProfileDto | undefined;

  return (
    <main className="space-y-8">
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to feed
      </Link>

      {/* Cinematic royal header band — matches /trips + /account. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <UserCircle aria-hidden className="h-3.5 w-3.5" /> Reviewer profile
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {body ? body.displayName : 'Reviewer'}
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          {body
            ? `${body.karma.reviewCount} review${body.karma.reviewCount === 1 ? '' : 's'} · ${body.karma.helpfulVotesReceived} helpful vote${body.karma.helpfulVotesReceived === 1 ? '' : 's'} received`
            : 'A traveller in the community.'}
        </p>
      </header>

      {isLoading ? (
        <Card depth="raised">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </Card>
      ) : isError ? (
        <Card depth="raised">
          <p className="text-sm text-danger">
            {apiErr?.code === 'USER_NOT_FOUND'
              ? "We couldn't find that reviewer."
              : `Couldn't load profile (${apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).`}
          </p>
        </Card>
      ) : body ? (
        <>
          <Card depth="raised">
            <CardHeader>
              <CardTitle>
                <KarmaPill displayName={body.displayName} score={body.karma.score} withIcon />
              </CardTitle>
              <CardSubtitle>
                {body.karma.reviewCount} review{body.karma.reviewCount === 1 ? '' : 's'} ·{' '}
                {body.karma.helpfulVotesReceived} helpful vote
                {body.karma.helpfulVotesReceived === 1 ? '' : 's'} received
              </CardSubtitle>
            </CardHeader>
            <BadgeShelf badges={body.karma.badges} />
          </Card>
          {token !== null ? <CreatorPanel userId={body.userId} /> : null}
          <Card depth="raised">
            <CardHeader>
              <CardTitle>Recent reviews</CardTitle>
              <CardSubtitle>Newest first.</CardSubtitle>
            </CardHeader>
            {body.recentReviews.length === 0 ? (
              <p className="text-sm text-muted">No reviews yet.</p>
            ) : (
              <ul className="space-y-3">
                {body.recentReviews.map((r) => (
                  <ReviewRow
                    key={r.id}
                    review={r}
                    canHelpful={token !== null && body.userId !== ''}
                    isOwn={false}
                    profileUserId={body.userId}
                  />
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </main>
  );
}

function ReviewRow({
  review,
  canHelpful,
  profileUserId,
}: {
  readonly review: PublicReviewerRecentReviewDto;
  readonly canHelpful: boolean;
  readonly isOwn: boolean;
  readonly profileUserId: string;
}) {
  const queryClient = useQueryClient();
  const [helpfulCount, setHelpfulCount] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const helpful = useReviewsControllerHelpful({
    mutation: {
      onSuccess: async (resp: { data?: unknown }) => {
        const r = resp.data as { helpfulCount: number };
        setHelpfulCount(r.helpfulCount);
        setErrMsg(null);
        // Profile karma changes as a side-effect of the inline
        // recompute; refetch so the score + badges update.
        await queryClient.invalidateQueries({
          queryKey: getPublicUserProfileControllerProfileQueryKey(profileUserId),
        });
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Vote failed.'}`);
      },
    },
  });
  return (
    <li className="rounded-2xl border border-gold-600/12 bg-surface p-4 text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25">
      <p className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Star aria-hidden className="h-3.5 w-3.5 text-gold-600" /> {review.rating}/5 ·{' '}
        {new Date(review.createdAt).toLocaleDateString()} · {review.targetType}
      </p>
      <p className="mt-1.5 font-display leading-relaxed text-surface-foreground/90">
        {review.body}
      </p>
      {canHelpful ? (
        <div className="mt-3 flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => helpful.mutate({ id: review.id })}
            disabled={helpful.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold-600/25 px-2.5 py-1 transition hover:bg-gold-500/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ThumbsUp aria-hidden className="h-3.5 w-3.5" /> Helpful
            {helpfulCount !== null ? ` (${helpfulCount})` : ''}
          </button>
          {errMsg ? <span className="text-danger">{errMsg}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * POST.2B.3 — the creator surface: this author's visible published
 * trips + follower/published counts + Follow / Block. Auth-only
 * (the /feed/creators endpoint is @CurrentUser-scoped), so the
 * parent renders this solely when signed in. Self-follow / blocked
 * pairs are rejected server-side in the domain — surfaced as a calm
 * toast, never a crash (LAW 2 lives in the API, the UI just obeys).
 */
function CreatorPanel({ userId }: { readonly userId: string }) {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getCreatorProfile(userId);
      setProfile(p);
      // Seed the Follow/Block buttons from the real relationship so they
      // no longer always read the default "Follow" / "Block".
      setFollowing(p.isFollowing);
      setBlocked(p.isBlocked);
    } catch {
      setProfile(null); // not a creator / not visible — hide the panel
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  const act = async (fn: () => Promise<unknown>, ok: string, flip: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      flip();
      toast.success(ok);
      await load();
    } catch (err) {
      const e = err as { code?: string; status?: number };
      toast.error(`Action failed (${e.code ?? e.status ?? 'error'}).`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card depth="raised">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </Card>
    );
  }
  if (!profile) return null;

  return (
    <Card depth="raised">
      <CardHeader>
        <CardTitle>Creator</CardTitle>
        <CardSubtitle>
          {/* J2 — follower count links into the connections list. */}
          <Link
            href={`/users/${userId}/followers` as Route}
            className="text-gold-600 underline-offset-4 hover:underline"
          >
            {profile.followerCount} follower{profile.followerCount === 1 ? '' : 's'}
          </Link>
          {' · '}
          <Link
            href={`/users/${userId}/following` as Route}
            className="text-gold-600 underline-offset-4 hover:underline"
          >
            Following
          </Link>
          {' · '}
          {profile.publishedCount} published trip{profile.publishedCount === 1 ? '' : 's'}
        </CardSubtitle>
      </CardHeader>
      <div className="mb-3 flex gap-2">
        <Button
          size="sm"
          variant={following ? 'outline' : 'royal'}
          disabled={busy || blocked}
          onClick={() =>
            following
              ? void act(
                  () => unfollowUser(userId),
                  'Unfollowed.',
                  () => setFollowing(false),
                )
              : void act(
                  () => followUser(userId),
                  'Following.',
                  () => setFollowing(true),
                )
          }
        >
          {following ? 'Following ✓' : 'Follow'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            blocked
              ? void act(
                  () => unblockUser(userId),
                  'Unblocked.',
                  () => setBlocked(false),
                )
              : void act(
                  () => blockUser(userId),
                  'Blocked.',
                  () => {
                    setBlocked(true);
                    setFollowing(false);
                  },
                )
          }
        >
          {blocked ? 'Unblock' : 'Block'}
        </Button>
      </div>
      {profile.trips.length === 0 ? (
        <p className="text-sm text-muted">No published trips you can see.</p>
      ) : (
        <ul className="grid gap-2">
          {profile.trips.map((t) => (
            <li key={t.tripId}>
              <Link
                href={`/trips/${t.tripId}` as Route}
                className="flex items-center gap-2 rounded-2xl border border-gold-600/15 bg-surface px-4 py-3 text-sm shadow-(--shadow-depth-1) transition hover:-translate-y-0.5 hover:border-gold-600/30 hover:shadow-(--shadow-depth-2) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MapPin aria-hidden className="h-4 w-4 shrink-0 text-gold-600" />
                <span className="font-display tracking-tight">Trip {t.tripId.slice(0, 8)}</span>
                <span className="ml-auto text-xs text-muted">{t.visibility.toLowerCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
