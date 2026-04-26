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
 * Installed by prompt [IV.18.19.52].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Your memory books</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/memory-books/new"
            className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground transition hover:opacity-90"
          >
            New book
          </Link>
          <Link
            href="/featured"
            className="text-sm text-muted hover:underline"
            aria-label="Browse featured public books"
          >
            Browse featured →
          </Link>
        </div>
      </div>
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
        <p className="rounded-md border border-muted/20 bg-muted/5 px-4 py-3 text-sm text-muted">
          No memory books yet — use the <strong>New book</strong> button to create one.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </ul>
      )}
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
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
    <Link href={`/memory-books/${book.id}/edit` as never} className="hover:underline">
      {book.title}
    </Link>
  );
  return (
    <Card as="li">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{titleNode}</CardTitle>
            <CardSubtitle>
              <Badge variant={published ? 'brand' : 'neutral'}>
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
                className="text-xs text-brand hover:underline"
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

function ErrorState({ error }: { error: unknown }) {
  const e = error as ApiError;
  return (
    <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      Couldn't load your books ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
    </p>
  );
}
