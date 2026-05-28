/**
 * /aether/about — Aether's manifesto / about page.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AboutLazy } from '@/components/aether/about/about-lazy';

export const metadata: Metadata = {
  title: 'Aether · What we believe',
  description:
    'Travel that listens before it speaks — six things we believe about the way India is travelled.',
  robots: { index: false, follow: false },
};

export default function AboutRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <AboutLazy />;
}
