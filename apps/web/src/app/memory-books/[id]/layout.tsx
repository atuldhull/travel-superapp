/**
 * V.UX.39 — server-side `generateMetadata` for the public memory-book
 * viewer. Fetches the public book payload at request time and
 * surfaces title + description + OG/Twitter card. The OG image is
 * the dynamic /og/memory-book/:id route (also V.UX.39).
 *
 * The page itself is a `'use client'` component so it can't export
 * generateMetadata — Next.js requires the export be on a server
 * file. A layout co-located with the page is the canonical pattern.
 *
 * Failures degrade silently to a generic title — never throw.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travelsuperapp.local';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface PublicMemoryBook {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string | null;
  readonly description?: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let book: PublicMemoryBook | null = null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/memory-books/public/${id}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const body = (await res.json()) as { book?: PublicMemoryBook };
      book = body.book ?? null;
    }
  } catch {
    book = null;
  }
  const title = book?.title ?? 'Memory book';
  const description =
    book?.subtitle ?? book?.description ?? 'A travel memory book on TravelSuperApp.';
  const ogImage = `${SITE_URL}/og/memory-book/${id}`;
  const url = `${SITE_URL}/memory-books/${id}`;
  return {
    title,
    description,
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'TravelSuperApp',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: { canonical: url },
  };
}

export default function MemoryBookViewerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
