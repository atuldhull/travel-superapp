'use client';

import dynamic from 'next/dynamic';

const DestinationsIndexShell = dynamic(
  async () => (await import('./destinations-index-shell')).DestinationsIndexShell,
  { ssr: false },
);

export function DestinationsIndexLazy(): React.ReactElement {
  return <DestinationsIndexShell />;
}
