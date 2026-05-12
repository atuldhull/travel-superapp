/**
 * V.UX.39 — Next.js 15 sitemap. Surfaces every public URL crawlers
 * should know about: landing, /featured, /accessibility, the
 * featured memory books, and any actively-live shared trips.
 *
 * Pure server component (Next.js calls this at request time when
 * sitemap.xml is requested). Failures degrade to the static URL set
 * — never throw, since a broken sitemap nukes SEO discovery.
 */
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travelsuperapp.local';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface FeaturedBookRow {
  readonly id: string;
  readonly updatedAt?: string;
}

async function fetchFeaturedBooks(): Promise<FeaturedBookRow[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/memory-books/public/featured?limit=50`, {
      // 1h ISR — cron crawlers don't need freshness more often than that.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { books?: FeaturedBookRow[] };
    return body.books ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/featured`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/accessibility`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/login`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/register`, changeFrequency: 'yearly', priority: 0.4 },
    // POST.6 — marketing + legal surface.
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/help`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/status`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/cookies`, changeFrequency: 'yearly', priority: 0.3 },
  ];
  const books = await fetchFeaturedBooks();
  const bookEntries: MetadataRoute.Sitemap = books.map((b) => ({
    url: `${SITE_URL}/memory-books/${b.id}`,
    lastModified: b.updatedAt ?? new Date().toISOString(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
  return [...staticEntries, ...bookEntries];
}
