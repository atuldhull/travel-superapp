'use client';

import dynamic from 'next/dynamic';

const JourneyShell = dynamic(async () => (await import('./journey-shell')).JourneyShell, {
  ssr: false,
});

export function JourneyLazy({ tripId }: { tripId: string }): React.ReactElement {
  return <JourneyShell tripId={tripId} />;
}
