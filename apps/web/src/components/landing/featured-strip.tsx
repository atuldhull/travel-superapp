/**
 * Featured-memory-books strip — 3 latest published books rendered as
 * a horizontal-scroll card row. Acts as social proof on the landing
 * page; clicking a card opens the auth-less public viewer.
 *
 * Pulls from the typed `useMemoryBookControllerFeatured` hook
 * (limit=3) so we share the cache with the full /featured page.
 *
 * Installed by prompt [V.UX.1].
 */
'use client';

import Link from 'next/link';
import {
  useMemoryBookControllerFeatured,
  type FeaturedMemoryBooksResponseDto,
  type PublicMemoryBookDto,
} from '@app/sdk';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export function FeaturedStrip() {
  const { data, isLoading, isError } = useMemoryBookControllerFeatured({ limit: '3' });

  const body = data?.data as unknown as FeaturedMemoryBooksResponseDto | undefined;
  const books: readonly PublicMemoryBookDto[] = body?.books ?? [];

  return (
    <section className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Real travelers, real memories
          </h2>
          <p className="mt-1 text-sm text-muted sm:text-base">
            A taste of what other travelers have published. Tap any card to read.
          </p>
        </div>
        <Link
          href="/featured"
          className="hidden text-sm font-semibold text-brand hover:underline sm:inline"
        >
          See all →
        </Link>
      </header>
      {isLoading ? (
        <ul className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card as="li" key={i}>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <Skeleton className="mt-1 h-3 w-1/2" />
            </Card>
          ))}
        </ul>
      ) : isError ? (
        <p className="rounded-md border border-muted/20 bg-muted/5 px-4 py-3 text-sm text-muted">
          Couldn't load featured books right now. Try the{' '}
          <Link href="/featured" className="text-brand hover:underline">
            full Featured page
          </Link>
          .
        </p>
      ) : books.length === 0 ? (
        <p className="rounded-md border border-muted/20 bg-muted/5 px-4 py-3 text-sm text-muted">
          No published memory books yet — be the first to{' '}
          <Link href="/register" className="text-brand hover:underline">
            sign up and publish
          </Link>{' '}
          one.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {books.map((b) => (
            <Card as="li" key={b.id}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/memory-books/${b.id}` as never} className="hover:underline">
                    {b.title}
                  </Link>
                </CardTitle>
                <CardSubtitle>
                  <Badge variant="brand">{b.theme}</Badge> · Published{' '}
                  {new Date(b.publishedAt).toLocaleDateString()}
                </CardSubtitle>
              </CardHeader>
            </Card>
          ))}
        </ul>
      )}
      <p className="text-center sm:hidden">
        <Link href="/featured" className="text-sm font-semibold text-brand hover:underline">
          See all featured books →
        </Link>
      </p>
    </section>
  );
}
