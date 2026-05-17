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
import { DestinationImage } from '../ui/destination-image';

export function FeaturedStrip() {
  const { data, isLoading, isError } = useMemoryBookControllerFeatured({ limit: '3' });

  const body = data?.data as unknown as FeaturedMemoryBooksResponseDto | undefined;
  const books: readonly PublicMemoryBookDto[] = body?.books ?? [];

  return (
    <section className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold-600/25 bg-gold-500/8 px-3 py-1 text-xs font-medium tracking-wide text-gold-700 dark:text-gold-300">
            Social proof
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-surface-foreground sm:text-4xl">
            Real travellers, real memories
          </h2>
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            A taste of what other travellers have published. Tap any card to read.
          </p>
        </div>
        <Link
          href="/featured"
          className="hidden text-sm font-semibold text-gold-600 transition hover:text-gold-700 hover:underline sm:inline dark:hover:text-gold-300"
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
        <p className="rounded-2xl border border-gold-600/15 bg-surface px-5 py-4 text-sm text-muted shadow-(--shadow-depth-1)">
          Couldn&apos;t load featured books right now. Try the{' '}
          <Link href="/featured" className="text-gold-600 hover:underline">
            full Featured page
          </Link>
          .
        </p>
      ) : books.length === 0 ? (
        <p className="rounded-2xl border border-gold-600/15 bg-surface px-5 py-4 text-sm text-muted shadow-(--shadow-depth-1)">
          No published memory books yet — be the first to{' '}
          <Link href="/register" className="text-gold-600 hover:underline">
            sign up and publish
          </Link>{' '}
          one.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {books.map((b) => (
            <Card as="li" key={b.id}>
              <Link
                href={`/memory-books/${b.id}` as never}
                tabIndex={-1}
                aria-hidden
                className="mb-4 block overflow-hidden rounded-xl"
              >
                <DestinationImage
                  place={b.title}
                  alt={b.title}
                  scrim
                  rounded="rounded-xl"
                  className="aspect-video w-full transition duration-300 hover:scale-[1.03]"
                />
              </Link>
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
        <Link
          href="/featured"
          className="text-sm font-semibold text-gold-600 transition hover:text-gold-700 hover:underline dark:hover:text-gold-300"
        >
          See all featured books →
        </Link>
      </p>
    </section>
  );
}
