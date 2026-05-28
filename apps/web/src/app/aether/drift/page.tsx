/**
 * /aether/drift — Phase 0 Aether preview surface.
 *
 * Gated by env var `NEXT_PUBLIC_FEATURE_AETHER_PREVIEW`. When the gate
 * is off, returns Next.js notFound() so the route looks like it doesn't
 * exist (we don't want curious visitors stumbling on a half-built surface).
 *
 * The canvas itself runs entirely client-side via <DriftShell> — the
 * page is a Server Component so the metadata + gate are statically
 * evaluable.
 */
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aether · Drift preview',
  description: 'A glimpse of the next surface. Warm Italian. Phase 0.',
  robots: { index: false, follow: false },
};

// SSR-disabled — R3F, WebGPU, Tone.js are all client-only.
const DriftShell = dynamic(
  async () => (await import('@/components/aether/drift-shell')).DriftShell,
  { ssr: false },
);

export default function DriftPage(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <DriftShell />;
}
