/**
 * /aether/destinations — full index of all destinations.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DestinationsIndexLazy } from '@/components/aether/destinations/destinations-index-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · All destinations';
const DESC = 'Fifteen ways to know India — from the Himalayan high desert to the Bay of Bengal.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC, { photoId: '1602216056096-3b40cc0c9944' }),
};

export default function DestinationsIndexRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <DestinationsIndexLazy />;
}
