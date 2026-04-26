/**
 * Public memory-book featured surface, now powered by the @app/sdk
 * generated React Query hook (`useMemoryBookControllerFeatured`)
 * instead of a raw SSR fetch.
 *
 * The hook flows through the shared `apiFetch` mutator, which
 * resolves base URL via `configureSdk` (set in providers.tsx) and
 * injects auth tokens from memory only (CLAUDE rule 12).
 *
 * Marked `'use client'` because TanStack Query hooks need the
 * client runtime. SSR streaming + hydration land in a follow-up
 * once the consumer surface justifies it.
 *
 * Casting the body shape: openapi.yaml currently lacks a response
 * schema for this endpoint, so orval generates `data: void`. Real
 * runtime shape is `{ books: [...] }` per the controller. A schema
 * pass on the api will tighten this in a follow-up slice.
 *
 * Installed by [IV.18.19.14]; SDK wire-through [IV.18.19.17].
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

  // Runtime shape is `{ books: PublicBook[] }`; spec lacks schema.
  const books = ((data as unknown as { books?: readonly PublicBook[] })?.books ??
    []) as readonly PublicBook[];

  return (
    <main>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>Featured memory books</h1>
      {isLoading ? (
        <p style={{ opacity: 0.7 }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: '#a00' }}>
          Couldn't reach the API. Is it running on{' '}
          <code>{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}</code>?
        </p>
      ) : books.length === 0 ? (
        <p style={{ color: '#a00' }}>
          No published books yet. Run <code>pnpm --filter=api db:seed:demo</code> to populate demo
          data.
        </p>
      ) : (
        <ul style={{ paddingLeft: '1.25rem' }}>
          {books.map((b) => (
            <li key={b.id} style={{ marginBottom: '0.75rem' }}>
              <strong>{b.title}</strong>
              <br />
              <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                Theme: {b.theme} · Published: {new Date(b.publishedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
