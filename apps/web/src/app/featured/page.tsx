/**
 * Public memory-book featured surface, powered by the @app/sdk
 * generated React Query hook (`useMemoryBookControllerFeatured`).
 *
 * The hook flows through the shared `apiFetch` mutator, which
 * resolves base URL via `configureSdk` (set in providers.tsx) and
 * injects auth tokens from memory only (CLAUDE rule 12).
 *
 * Marked `'use client'` because TanStack Query hooks need the
 * client runtime.
 *
 * Casting the body shape: openapi.yaml currently lacks a response
 * schema for this endpoint, so orval generates `data: void`. Real
 * runtime shape is `{ books: [...] }` per the controller. A schema
 * pass on the api will tighten this in a follow-up slice.
 *
 * Installed by [IV.18.19.14]; SDK wire-through [IV.18.19.17];
 * Tailwind theming [IV.18.19.18]; Card/Skeleton refactor [IV.18.19.27];
 * link-to-viewer + theme badge [IV.18.19.47].
 */
'use client';

import Link from 'next/link';
import {
  useMemoryBookControllerFeatured,
  type FeaturedMemoryBooksResponseDto,
  type PublicMemoryBookDto,
} from '@app/sdk';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';

export default function FeaturedPage() {
  const { data, isLoading, isError } = useMemoryBookControllerFeatured({ limit: '20' });

  // apiFetch returns orval's `{data, status, headers}` envelope, so
  // React Query's `data.data` is the typed body.
  const body = data?.data as unknown as FeaturedMemoryBooksResponseDto | undefined;
  const books: readonly PublicMemoryBookDto[] = body?.books ?? [];

  return (
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Featured memory books</h1>
        <p className="text-sm text-muted">
          Public books published by other travelers. Tap a card to open the public read view.
        </p>
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
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't reach the API. Is it running on{' '}
          <code className="rounded bg-danger/10 px-1 py-0.5">
            {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}
          </code>
          ?
        </p>
      ) : books.length === 0 ? (
        <p className="rounded-md border border-muted/20 bg-muted/5 px-4 py-3 text-sm text-muted">
          No published books yet. Run{' '}
          <code className="rounded bg-muted/15 px-1 py-0.5">pnpm --filter=api db:seed:demo</code> to
          populate demo data.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {books.map((b) => (
            <li key={b.id}>
              <Link
                href={`/memory-books/${b.id}` as never}
                className="block rounded-md transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{b.title}</CardTitle>
                      <Badge variant="brand">{b.theme}</Badge>
                    </div>
                    <CardSubtitle>
                      Published {new Date(b.publishedAt).toLocaleDateString()}
                    </CardSubtitle>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
