/**
 * /aether/destinations — full index of all destinations.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DestinationsIndexLazy } from '@/components/aether/destinations/destinations-index-lazy';

export const metadata: Metadata = {
  title: 'Aether · All destinations',
  description: 'Ten ways to know India — from the Himalayan high desert to the Bay of Bengal.',
  robots: { index: false, follow: false },
};

export default function DestinationsIndexRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <DestinationsIndexLazy />;
}
