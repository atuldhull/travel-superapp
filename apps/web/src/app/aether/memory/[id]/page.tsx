/**
 * /aether/memory/[id] — Lumen Phase 2 memory studio.
 *
 * Server Component: env check + notFound() guard + metadata. The
 * actual surface ships from `<MemoryLazy>` (Client Component) because
 * Next 15 forbids ssr:false here.
 *
 * Gated by both `NEXT_PUBLIC_FEATURE_AETHER_PREVIEW` (the editorial
 * baseline gate every Aether route honours) and
 * `NEXT_PUBLIC_FEATURE_AETHER_PHASE1` (the R3F runtime gate Phase 2
 * also rides on until it earns its own env var).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MemoryLazy } from '@/components/aether/memory-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Memory';
const DESC = 'Photos float in a 3D cloud sorted by time + rating. Lumen, the memory studio.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

interface Props {
  readonly params: Promise<{ id: string }>;
}

export default async function MemoryPage({ params }: Props): Promise<React.ReactElement> {
  if (
    process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1' ||
    process.env['NEXT_PUBLIC_FEATURE_AETHER_PHASE1'] !== '1'
  ) {
    notFound();
  }
  const { id } = await params;
  return <MemoryLazy bookId={id} />;
}
