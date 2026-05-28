/**
 * /aether/me/journeys — Aether-styled list of the signed-in user's trips.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JourneysLazy } from '@/components/aether/me/journeys-lazy';

export const metadata: Metadata = {
  title: 'Aether · Your journeys',
  description: 'Every road you have sketched, in one place.',
  robots: { index: false, follow: false },
};

export default function JourneysIndexRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <JourneysLazy />;
}
