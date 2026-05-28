/**
 * /aether/me — landing for the authed user's surfaces.
 * Three cards (Journeys / Shares / Account) + quick stats.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MeLazy } from '@/components/aether/me-home/me-lazy';

export const metadata: Metadata = {
  title: 'Aether · My atlas',
  description: 'Your journeys, your shares, your account — in one quiet view.',
  robots: { index: false, follow: false },
};

export default function MeHomeRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <MeLazy />;
}
