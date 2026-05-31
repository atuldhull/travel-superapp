/**
 * /aether/vault — Phase 2 Vault (bookings + commerce) surface.
 *
 * Same double env gate as the memory route (PREVIEW + PHASE1) until
 * Phase 2 earns its own flag.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { VaultLazy } from '@/components/aether/vault-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Vault';
const DESC = 'Prices float as weighted glyphs. Vault, the bookings + commerce surface.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function VaultPage(): React.ReactElement {
  if (
    process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1' ||
    process.env['NEXT_PUBLIC_FEATURE_AETHER_PHASE1'] !== '1'
  ) {
    notFound();
  }
  return <VaultLazy />;
}
