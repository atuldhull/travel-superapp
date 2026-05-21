/**
 * Phase 5 (J4) — comment thread for a published trip.
 *
 * Self-contained: fetches the thread, renders a composer, posts +
 * deletes. Comments only exist on PUBLISHED trips — the API enforces
 * that, so when a post fails with TRIP_NOT_COMMENTABLE we show a
 * calm explainer instead of pretending it worked.
 *
 * Block-filtering happens server-side; the component just renders
 * what it's allowed to see.
 *
 * Installed by prompt [J4].
 */
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import {
  deleteTripComment,
  getTripComments,
  postTripComment,
  type TripCommentDto,
} from '../../lib/two-oh-api';
import { useAuthToken } from '../../lib/use-auth-token';
import { decodeJwtSub } from '../../lib/jwt-sub';

const MAX = 1000;

interface TripCommentsProps {
  readonly tripId: string;
}

export function TripComments({ tripId }: TripCommentsProps) {
  // The viewer's own id — enables delete buttons on their comments.
  // Display-only; the API re-checks ownership on every delete.
  const currentUserId = decodeJwtSub(useAuthToken());
  const [comments, setComments] = useState<readonly TripCommentDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await getTripComments(tripId);
        if (alive) setComments(res.comments);
      } catch {
        if (alive) setComments([]);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tripId]);

  const submit = async () => {
    const body = draft.trim();
    if (body.length === 0 || posting) return;
    setPosting(true);
    setError(null);
    try {
      const created = await postTripComment(tripId, body);
      setComments((prev) => [...prev, created]);
      setDraft('');
    } catch (err) {
      const e = err as { code?: string; status?: number };
      setError(
        e.code === 'TRIP_NOT_COMMENTABLE'
          ? 'Comments open once this trip is published to the feed.'
          : `Couldn't post your comment (${e.code ?? e.status ?? 'error'}).`,
      );
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTripComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Couldn't delete that comment.");
    }
  };

  return (
    <section className="rounded-2xl border border-gold-600/15 bg-surface/60 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-surface-foreground">
        <MessageCircle aria-hidden className="h-5 w-5 text-gold-600" /> Comments
        {loaded && comments.length > 0 ? (
          <span className="rounded-full border border-gold-600/20 bg-gold-500/8 px-2 py-0.5 text-xs text-muted">
            {comments.length}
          </span>
        ) : null}
      </h2>

      {/* Composer */}
      <div className="mt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
          rows={2}
          placeholder="Share a thought on this trip…"
          className="w-full resize-y rounded-xl border border-muted/30 bg-transparent px-3 py-2 text-sm text-surface-foreground placeholder:text-muted/70 focus:border-gold-600/50 focus:outline-none"
        />
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">
            {draft.length}/{MAX}
          </span>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={posting || draft.trim().length === 0}
            className="rounded-full bg-gold-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-gold-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error ? (
          <p className="mt-1.5 rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      {/* Thread */}
      <div className="mt-4">
        {!loaded ? (
          <p className="text-sm text-muted">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted">No comments yet — be the first.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => {
              const mine = currentUserId !== null && c.authorId === currentUserId;
              const name = c.authorDisplayName ?? (mine ? 'You' : 'Traveller');
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-gold-600/12 bg-surface px-3.5 py-2.5 shadow-(--shadow-depth-1)"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/users/${c.authorId}` as Route}
                      className="text-sm font-medium text-surface-foreground hover:underline"
                    >
                      {name}
                    </Link>
                    <span className="flex items-center gap-2 text-[11px] text-muted">
                      {new Date(c.createdAt).toLocaleDateString()}
                      {mine ? (
                        <button
                          type="button"
                          onClick={() => void remove(c.id)}
                          aria-label="Delete comment"
                          className="text-muted transition hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-surface-foreground/90">
                    {c.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
