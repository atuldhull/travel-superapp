/**
 * Public memory-book featured surface, powered by the @app/sdk
 * generated React Query hook (`useMemoryBookControllerFeatured`).
 *
 * The hook flows through the shared `apiFetch` mutator, which
 * resolves base URL via `configureSdk` (set in providers.tsx) and
 * injects auth tokens from memory only (CLAUDE rule 12).
 *
 * Marked `'use client'` because TanStack Query hooks need the
 * client runtime. Tailwind 4 themed cards land via `[IV.18.19.18]`.
 *
 * Casting the body shape: openapi.yaml currently lacks a response
 * schema for this endpoint, so orval generates `data: void`. Real
 * runtime shape is `{ books: [...] }` per the controller. A schema
 * pass on the api will tighten this in a follow-up slice.
 *
 * Installed by [IV.18.19.14]; SDK wire-through [IV.18.19.17];
 * Tailwind theming [IV.18.19.18].
 */
'use client';

import Link from 'next/link';
import { useMemoryBookControllerFeatured } from '@app/sdk';

interface PublicBook {
  readonly id: string;
  readonly title: string;
  readonly theme: string;
  readonly publishedAt: string;
}

export default function FeaturedPage() {
  const { data, isLoading, isError } = useMemoryBookControllerFeatured({ limit: '20' });

  const books = ((data as unknown as { books?: readonly PublicBook[] })?.books ??
    []) as readonly PublicBook[];

  return (
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Featured memory books</h1>
      {isLoading ? (
        <p className="text-muted">Loading…</p>
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
            <BookCard key={b.id} book={b} />
          ))}
        </ul>
      )}
    </main>
  );
}

function BookCard({ book }: { book: PublicBook }) {
  return (
    <li className="rounded-lg border border-muted/20 bg-surface p-4 shadow-sm transition hover:shadow">
      <h2 className="text-lg font-semibold tracking-tight">{book.title}</h2>
      <p className="mt-1 text-sm text-muted">
        Theme: <span className="font-medium">{book.theme}</span>
      </p>
      <p className="text-sm text-muted">
        Published: {new Date(book.publishedAt).toLocaleDateString()}
      </p>
    </li>
  );
}
