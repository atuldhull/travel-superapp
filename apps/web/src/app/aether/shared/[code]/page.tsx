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
import { aetherOg } from '@/lib/aether-og';

interface PageProps {
  readonly params: Promise<{ readonly code: string }>;
}

const TITLE = 'Aether · A shared journey';
const DESC = 'Someone else’s sketch of the road. Read it, clone it, refuse it.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default async function SharedTripRoute({ params }: PageProps): Promise<React.ReactElement> {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  const { code } = await params;
  return <SharedLazy code={code} />;
}
