/**
 * /aether/onboarding — first-time editorial welcome flow.
 *
 * Three soft beats: a slow hero, what we believe, the first CTA.
 * Marks aether-onboarded=1 in localStorage so it only shows once.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { OnboardingLazy } from '@/components/aether/onboarding/onboarding-lazy';

export const metadata: Metadata = {
  title: 'Aether · Begin',
  description: 'Slow travel, sketched by AI — your first yatra in three breaths.',
  robots: { index: false, follow: false },
};

export default function OnboardingRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <OnboardingLazy />;
}
