/**
 * /aether/mirror — Phase 3 Mirror (admin forensics) surface.
 *
 * Same double env gate as the rest of the Phase 1+ Aether routes
 * until Phase 3 earns its own flag. The route renders the surface to
 * any signed-in user with the flag on; the admin-gate UI inside the
 * shell decides whether to show the live ops data or a "no access"
 * card. That mirrors how the existing /aether/dispatch admin view
 * works in Phase 0.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MirrorLazy } from '@/components/aether/mirror-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Mirror';
const DESC = 'Admin forensics — SOS globe, scam clusters, audit-log river.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function MirrorPage(): React.ReactElement {
  if (
    process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1' ||
    process.env['NEXT_PUBLIC_FEATURE_AETHER_PHASE1'] !== '1'
  ) {
    notFound();
  }
  return <MirrorLazy />;
}
