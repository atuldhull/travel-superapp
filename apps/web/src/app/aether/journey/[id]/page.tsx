/**
 * /aether/journey/[id] — Aether-styled live view of a real trip.
 *
 * Server Component: env-gate + slug pass-through; the client shell
 * does the actual data fetch via useTripControllerGetOne.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JourneyLazy } from '@/components/aether/journey/journey-lazy';

export const metadata: Metadata = {
  title: 'Aether · Your journey',
  description: 'A live editorial view of your drafted trip.',
  robots: { index: false, follow: false },
};

export default async function JourneyRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  const { id } = await params;
  return <JourneyLazy tripId={id} />;
}
