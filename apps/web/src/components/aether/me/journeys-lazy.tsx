'use client';

import dynamic from 'next/dynamic';

const JourneysShell = dynamic(async () => (await import('./journeys-shell')).JourneysShell, {
  ssr: false,
});

export function JourneysLazy(): React.ReactElement {
  return <JourneysShell />;
}
