/**
 * /aether/atlas — the constellation map surface (Phase 0 sketch).
 *
 * Editorial constellation rather than a literal geographic India map.
 * Six destinations pinned by approximate geographic position, joined
 * by a thin gold filament. Hover reveals tagline; click navigates
 * to the destination detail page (AE9).
 *
 * Phase 1 Atlas will replace this with deck.gl + WebGPU map + real
 * coordinates + route ribbons (per docs/aether/02-surfaces.md).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AtlasLazy } from '@/components/aether/atlas/atlas-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Atlas';
const DESC = 'A constellation of fifteen Indian destinations, pinned on a dark map.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC, { photoId: '1567619313084-90c11abfbe53' }),
};

export default function AtlasPage(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <AtlasLazy />;
}
