/**
 * V.UX.39 — static OG metadata for /featured. The page is
 * 'use client' so we land the metadata via a co-located layout.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travelsuperapp.local';

export const metadata: Metadata = {
  title: 'Featured travel memory books · TravelSuperApp',
  description:
    'Hand-picked memory books from travelers using TravelSuperApp. Browse photos, itineraries, and recommendations from real trips.',
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/featured`,
    title: 'Featured travel memory books',
    description: 'Hand-picked memory books from travelers using TravelSuperApp.',
    siteName: 'TravelSuperApp',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Featured travel memory books',
    description: 'Hand-picked memory books from travelers using TravelSuperApp.',
  },
  alternates: { canonical: `${SITE_URL}/featured` },
};

export default function FeaturedLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
