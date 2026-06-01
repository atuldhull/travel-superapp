/**
 * /aether/feed — Phase 3 Echo (social feed) surface.
 *
 * Same double env gate as the rest of the Phase 1+ Aether routes
 * until Phase 3 earns its own flag.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { EchoLazy } from '@/components/aether/echo-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Echo';
const DESC = 'Vertical-scroll moments from travellers, room re-tinting as you go.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function EchoPage(): React.ReactElement {
  if (
    process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1' ||
    process.env['NEXT_PUBLIC_FEATURE_AETHER_PHASE1'] !== '1'
  ) {
    notFound();
  }
  return <EchoLazy />;
}
