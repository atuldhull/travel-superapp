/**
 * Owner-scoped memory-book index — `/memory-books`. Lists the
 * caller's books (drafts + published) via the typed
 * `useMemoryBookControllerList` hook landed in slice .19.51. Same
 * auth pattern as `/trips`: bounce to `/login` once silent-refresh
 * has had its chance and we still have no token.
 *
 * Each row links to the existing public viewer at
 * `/memory-books/[id]` for published books, or shows a "draft"
 * badge with no link for unpublished ones (the public route 404s
 * for drafts by contract — no point linking).
 *
 * Installed by prompt [IV.18.19.52]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens, cinematic header band,
 * font-display, gold-tokened cards) alongside the new landing.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BookOpen, Plus, Sparkles } from 'lucide-react';
import {
  useMemoryBookControllerList,
  type ListMemoryBooksResponseDto,
  type MemoryBookDto,
} from '@app/sdk';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface ApiError {
  readonly code?: string;
  readonly status?: number;
  readonly message?: string;
}

export default function MemoryBooksIndexPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useMemoryBookControllerList(
    { limit: '50' },
    { query: { enabled: token !== null } },
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

  const body = data?.data as unknown as ListMemoryBooksResponseDto | undefined;
  const books: readonly MemoryBookDto[] = body?.books ?? [];

  return (
    <main className="space-y-8">
      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-9 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
              <BookOpen aria-hidden className="h-3.5 w-3.5" /> Your memories
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Your memory books
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/65">
              Hand-crafted keepsakes from your journeys — drafts and published, all in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/memory-books/new"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              style={{ backgroundImage: 'var(--gradient-gold)' }}
            >
              <Plus aria-hidden className="h-4 w-4" /> New book
            </Link>
            <Link
              href="/featured"
              aria-label="Browse featured public books"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              <Sparkles aria-hidden className="h-4 w-4" /> Browse featured
            </Link>
          </div>
        </div>
      </header>

      {isLoading ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card as="li" key={i}>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <Skeleton className="mt-1 h-3 w-1/2" />
            </Card>
          ))}
        </ul>
      ) : isError ? (
        <ErrorState error={error} />
      ) : books.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </ul>
      )}

      <p className="pt-2">
        <Link
          href="/"
          className="text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
        >
          ← Back home
        </Link>
      </p>
    </main>
  );
}

function BookCard({ book }: { book: MemoryBookDto }) {
  // Orval emits nullable string fields as `{ [k: string]: unknown } | null`,
  // which doesn't render — cast to the runtime shape per autopilot gotcha.
  const coverS3Key = book.coverS3Key as unknown as string | null;
  const publishedAt = book.publishedAt as unknown as string | null;
  const published = publishedAt !== null;
  // Title always links to the owner-side edit page (slice .19.53). The
  // public viewer at /memory-books/[id] gets a separate "Public view"
  // link below for published books only — drafts have no public route.
  const titleNode = (
    <Link
      href={`/memory-books/${book.id}/edit` as never}
      className="rounded outline-none transition hover:text-gold-700 focus:ring-2 focus:ring-accent dark:hover:text-gold-300"
    >
      {book.title}
    </Link>
  );
  return (
    <Card as="li" depth="raised" interactive>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{titleNode}</CardTitle>
            <CardSubtitle>
              <Badge variant={published ? 'gold' : 'neutral'}>
                {published ? 'published' : 'draft'}
              </Badge>{' '}
              · Theme {book.theme}
            </CardSubtitle>
          </div>
          <div className="flex flex-col items-end gap-1">
            {published && publishedAt ? (
              <p className="text-xs text-muted">{new Date(publishedAt).toLocaleDateString()}</p>
            ) : null}
            {published ? (
              <Link
                href={`/memory-books/${book.id}` as never}
                className="text-xs font-medium text-gold-700 underline-offset-4 transition hover:underline dark:text-gold-300"
              >
                Public view →
              </Link>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {coverS3Key ? (
        <p className="mt-2 truncate text-xs text-muted">
          Cover: <code className="font-mono text-[10px]">{coverS3Key}</code>
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Illustrated empty-state for owners with no books yet. Gold gradient
 * panel + CTA, mirroring the /trips first-run treatment.
 */
function EmptyState() {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 bg-gradient-to-br from-gold-500/8 via-transparent to-brand/5 px-6 py-14 text-center shadow-(--shadow-depth-1)">
      <div
        aria-hidden
        className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full border border-gold-500/30 bg-gold-500/10 text-gold-600"
      >
        <BookOpen aria-hidden className="h-9 w-9" />
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight text-surface-foreground sm:text-3xl">
        No memory books yet
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Turn a trip into a beautifully bound keepsake — drafts stay private until you publish.
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          href="/memory-books/new"
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          style={{ backgroundImage: 'var(--gradient-gold)' }}
        >
          <Plus aria-hidden className="h-4 w-4" /> Create your first book
        </Link>
      </div>
    </section>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const e = error as ApiError;
  return (
    <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      Couldn&apos;t load your books ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
    </p>
  );
}
