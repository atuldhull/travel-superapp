/**
 * /aether/shared/[code] — Aether-styled read-only view of a shared trip.
 *
 * Replaces the bare /shared/[code] page for Aether visitors. Uses the
 * public GET /trips/shared/{code} endpoint. Read-only — no edit
 * affordances. Authed visitors can clone the journey into their own
 * account via POST /trips/shared/{code}/clone.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SharedLazy } from '@/components/aether/shared/shared-lazy';

interface PageProps {
  readonly params: Promise<{ readonly code: string }>;
}

export const metadata: Metadata = {
  title: 'Aether · A shared journey',
  description: 'Someone else’s sketch of the road. Read it, clone it, refuse it.',
  robots: { index: false, follow: false },
};

export default async function SharedTripRoute({ params }: PageProps): Promise<React.ReactElement> {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  const { code } = await params;
  return <SharedLazy code={code} />;
}
