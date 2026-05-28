/**
 * /aether/about — Aether's manifesto / about page.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AboutLazy } from '@/components/aether/about/about-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · What we believe';
const DESC =
  'Travel that listens before it speaks — six things we believe about the way India is travelled.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function AboutRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <AboutLazy />;
}
