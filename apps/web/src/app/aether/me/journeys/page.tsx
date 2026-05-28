/**
 * /aether/me/journeys — Aether-styled list of the signed-in user's trips.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JourneysLazy } from '@/components/aether/me/journeys-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Your journeys';
const DESC = 'Every road you have sketched, in one place.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function JourneysIndexRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <JourneysLazy />;
}
