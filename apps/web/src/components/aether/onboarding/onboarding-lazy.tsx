'use client';

import dynamic from 'next/dynamic';

const OnboardingShell = dynamic(async () => (await import('./onboarding-shell')).OnboardingShell, {
  ssr: false,
});

export function OnboardingLazy(): React.ReactElement {
  return <OnboardingShell />;
}
