/**
 * /aether/me/shares — every share link the caller has minted across
 * their journeys, listed in one place with a Revoke button per share.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SharesLazy } from '@/components/aether/me/shares-lazy';

export const metadata: Metadata = {
  title: 'Aether · Your shares',
  description: 'Every share link you have minted, in one place.',
  robots: { index: false, follow: false },
};

export default function SharesIndexRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <SharesLazy />;
}
