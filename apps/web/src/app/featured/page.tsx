/**
 * Server-side fetch + render of the public memory-book featured
 * surface from `[IV.18.13.1]`. Demonstrates the SSR data-fetch
 * path against the api app:
 *
 *   - `process.env.API_URL` (defaults to http://localhost:3000) is
 *     the api base. In prod the Fly app or external URL.
 *   - `cache: 'no-store'` so a fresh deploy + seed shows up in the
 *     same render. Prod can switch to `revalidate: 60` when traffic
 *     justifies the cache.
 *   - Errors render a degraded state, not a 500 — the page still
 *     loads even if the api is down.
 *
 * Installed by prompt [IV.18.19.14].
 */
import Link from 'next/link';

interface PublicBook {
  readonly id: string;
  readonly title: string;
  readonly theme: string;
  readonly publishedAt: string;
}

async function fetchFeatured(): Promise<PublicBook[]> {
  const apiBase = process.env.API_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${apiBase}/api/v1/memory-books/featured`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { books: PublicBook[] };
    return body.books;
  } catch {
    return [];
  }
}

export default async function FeaturedPage() {
  const books = await fetchFeatured();

  return (
    <main>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>Featured memory books</h1>
      {books.length === 0 ? (
        <p style={{ color: '#a00' }}>
          No published books yet, or the API is unreachable. Run{' '}
          <code>pnpm --filter=api db:seed:demo</code> to populate demo data.
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
