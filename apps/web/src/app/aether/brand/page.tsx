/**
 * /aether/brand — press kit + design language reference.
 *
 * Shows the Warm-Italian palette + the type stack + the AetherMark
 * glyph. Useful for press / partners / future designers; doubles as
 * a stable swatch reference for the team.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BrandLazy } from '@/components/aether/brand/brand-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Brand';
const DESC = 'Palette, type, and the mark — Aether 2.0 design language at a glance.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function BrandRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <BrandLazy />;
}
