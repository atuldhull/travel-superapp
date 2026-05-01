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

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getPublicUserProfileControllerProfileQueryKey,
  usePublicUserProfileControllerProfile,
  useReviewsControllerHelpful,
  type PublicReviewerProfileDto,
  type PublicReviewerRecentReviewDto,
} from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { BadgeShelf } from '../../../components/social/badge-shelf';
import { KarmaPill } from '../../../components/social/karma-pill';
import { useAuthToken } from '../../../lib/use-auth-token';

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
    <main className="space-y-6">
      {isLoading ? (
        <Card>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </Card>
      ) : isError ? (
        <Card>
          <p className="text-sm text-danger">
            {apiErr?.code === 'USER_NOT_FOUND'
              ? "We couldn't find that reviewer."
              : `Couldn't load profile (${apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).`}
          </p>
        </Card>
      ) : body ? (
        <>
          <Card>
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
          <Card>
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
    <li className="rounded border border-muted/15 p-3 text-sm">
      <p className="text-xs text-muted">
        ★ {review.rating}/5 · {new Date(review.createdAt).toLocaleDateString()} ·{' '}
        {review.targetType}
      </p>
      <p className="mt-1 leading-relaxed">{review.body}</p>
      {canHelpful ? (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => helpful.mutate({ id: review.id })}
            disabled={helpful.isPending}
            className="rounded-md border border-muted/30 px-2 py-1 hover:bg-muted/10 disabled:opacity-50"
          >
            👍 Helpful{helpfulCount !== null ? ` (${helpfulCount})` : ''}
          </button>
          {errMsg ? <span className="text-danger">{errMsg}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
