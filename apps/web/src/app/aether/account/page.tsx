/**
 * /aether/account — Aether-styled identity + settings view.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AccountLazy } from '@/components/aether/account/account-lazy';

export const metadata: Metadata = {
  title: 'Aether · Your atlas',
  description: 'Your identity, your settings, your road.',
  robots: { index: false, follow: false },
};

export default function AccountRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <AccountLazy />;
}
