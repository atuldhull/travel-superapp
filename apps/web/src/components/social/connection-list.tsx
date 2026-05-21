/**
 * Phase 5 (J2) — follower / following list.
 *
 * Renders one direction of the follow graph for a user. The graph +
 * counts shipped in POST.2B.1 but had no list UI — this is it. The
 * API block-filters against the signed-in viewer, so the list a
 * viewer sees is already free of users they blocked / who blocked
 * them; this component just renders honestly.
 *
 * Shared by `/users/[id]/followers` and `/users/[id]/following`.
 *
 * Installed by prompt [J2].
 */
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { ArrowLeft, UserRound, Users } from 'lucide-react';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { getFollowers, getFollowing, type ConnectionUser } from '../../lib/two-oh-api';

interface ConnectionListProps {
  readonly userId: string;
  readonly kind: 'followers' | 'following';
}

export function ConnectionList({ userId, kind }: ConnectionListProps) {
  const [users, setUsers] = useState<readonly ConnectionUser[] | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    setUsers(null);
    setErrored(false);
    void (async () => {
      try {
        const res = kind === 'followers' ? await getFollowers(userId) : await getFollowing(userId);
        if (alive) setUsers(res.users);
      } catch {
        if (alive) setErrored(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, kind]);

  const heading = kind === 'followers' ? 'Followers' : 'Following';
  const emptyCopy = kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.';

  return (
    <main className="space-y-5">
      <p>
        <Link
          href={`/users/${userId}` as Route}
          className="inline-flex items-center gap-1 text-sm text-muted hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to profile
        </Link>
      </p>

      <header className="flex items-center gap-2">
        <Users aria-hidden className="h-5 w-5 text-gold-600" />
        <h1 className="font-display text-2xl text-surface-foreground">{heading}</h1>
        {users !== null ? (
          <span className="rounded-full border border-gold-600/20 bg-gold-500/8 px-2 py-0.5 text-xs text-muted">
            {users.length}
          </span>
        ) : null}
      </header>

      {users === null && !errored ? (
        <Card className="p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-2 h-5 w-1/2" />
        </Card>
      ) : errored ? (
        <Card className="p-5">
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t load this list. Please try again.
          </p>
        </Card>
      ) : users && users.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted">{emptyCopy}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {(users ?? []).map((u) => (
            <li key={u.userId}>
              <Link
                href={`/users/${u.userId}` as Route}
                className="flex items-center gap-3 rounded-2xl border border-gold-600/15 bg-surface/70 px-4 py-3 shadow-(--shadow-depth-1) transition hover:-translate-y-0.5 hover:border-gold-600/35 hover:shadow-(--shadow-depth-2) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-600/25 bg-gold-500/10">
                  <UserRound aria-hidden className="h-4 w-4 text-gold-600" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-surface-foreground">
                    {u.displayName}
                  </span>
                  <span className="block text-xs text-muted">
                    {kind === 'followers' ? 'Followed' : 'Following since'}{' '}
                    {new Date(u.followedAt).toLocaleDateString()}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
