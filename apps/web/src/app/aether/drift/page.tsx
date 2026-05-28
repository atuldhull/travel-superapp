/**
 * /aether/drift — Phase 0 Aether preview surface.
 *
 * Gated by env var `NEXT_PUBLIC_FEATURE_AETHER_PREVIEW`. When the gate
 * is off, returns Next.js notFound() so the route looks like it doesn't
 * exist (we don't want curious visitors stumbling on a half-built surface).
 *
 * This file is a Server Component (metadata + env check + notFound).
 * The actual canvas is in <DriftLazy>, a tiny Client Component wrapper
 * that does the `dynamic(..., { ssr: false })` import — required pattern
 * since Next 15 disallows ssr:false from Server Components.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DriftLazy } from '@/components/aether/drift-lazy';

export const metadata: Metadata = {
  title: 'Aether · Drift preview',
  description: 'A glimpse of the next surface. Warm Italian. Phase 0.',
  robots: { index: false, follow: false },
};

export default function DriftPage(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <DriftLazy />;
}
