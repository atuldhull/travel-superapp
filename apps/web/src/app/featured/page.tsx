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
import { ArrowLeft, BookOpen, CloudOff, Sparkles } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { SkeletonCard } from '../../components/ui/skeleton';

export default function FeaturedPage() {
  const { data, isLoading, isError } = useMemoryBookControllerFeatured({ limit: '20' });

  // apiFetch returns orval's `{data, status, headers}` envelope, so
  // React Query's `data.data` is the typed body.
  const body = data?.data as unknown as FeaturedMemoryBooksResponseDto | undefined;
  const books: readonly PublicMemoryBookDto[] = body?.books ?? [];

  return (
    <main className="space-y-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back
      </Link>

      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-12 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/20 blur-[120px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> Curated
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Featured Memory Books
        </h1>
        <p className="relative mt-2 max-w-md text-sm text-white/65">
          Real journeys, published by fellow travellers. Open one to read it.
        </p>
      </header>

      {isLoading ? (
        <SkeletonCard count={4} className="sm:grid-cols-2" />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-600/15 bg-surface px-6 py-14 text-center shadow-(--shadow-depth-1)">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-600 shadow-(--shadow-depth-1)">
            <CloudOff aria-hidden className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
            The library is offline
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            We can&apos;t reach the API right now. Once it&apos;s running on{' '}
            <code className="rounded bg-gold-500/10 px-1.5 py-0.5 font-mono text-xs text-gold-700 dark:text-gold-300">
              {process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000'}
            </code>{' '}
            the featured books appear here.
          </p>
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-600/15 bg-surface px-6 py-14 text-center shadow-(--shadow-depth-1)">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-600 shadow-(--shadow-depth-1)">
            <BookOpen aria-hidden className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-surface-foreground">
            No published books yet
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Seed demo data with{' '}
            <code className="rounded bg-gold-500/10 px-1.5 py-0.5 font-mono text-xs text-gold-700 dark:text-gold-300">
              pnpm --filter=api db:seed:demo
            </code>
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {books.map((b) => (
            <li key={b.id}>
              <Link
                href={`/memory-books/${b.id}` as never}
                className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-gold-600/12 bg-surface p-5 shadow-(--shadow-depth-1) transition duration-200 hover:-translate-y-1 hover:border-gold-600/30 hover:shadow-(--shadow-depth-3) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-gold-500/10 blur-2xl transition group-hover:bg-gold-500/20"
                />
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold leading-snug tracking-tight text-surface-foreground">
                    {b.title}
                  </h2>
                  <Badge variant="gold">{b.theme}</Badge>
                </div>
                <p className="mt-auto text-sm text-muted">
                  Published {new Date(b.publishedAt).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
