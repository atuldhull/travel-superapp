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

export const metadata: Metadata = {
  title: 'Aether · Atlas',
  description: 'A constellation map of destinations. Phase 0 sketch.',
  robots: { index: false, follow: false },
};

export default function AtlasPage(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <AtlasLazy />;
}
