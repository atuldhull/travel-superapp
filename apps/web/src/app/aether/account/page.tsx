/**
 * /aether/account — Aether-styled identity + settings view.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AccountLazy } from '@/components/aether/account/account-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Your atlas';
const DESC = 'Your identity, your settings, your road.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function AccountRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <AccountLazy />;
}
