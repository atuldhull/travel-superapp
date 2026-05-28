'use client';

/**
 * Client-side lazy boundary for destination pages — same pattern as
 * drift-lazy.tsx. Next 15 disallows `ssr: false` inside Server
 * Components; this Client Component owns the dynamic import.
 */
import dynamic from 'next/dynamic';
import { type Destination } from './data';

const DestinationShell = dynamic(
  async () => (await import('./destination-shell')).DestinationShell,
  { ssr: false },
);

export function DestinationLazy({ destination }: { destination: Destination }): React.ReactElement {
  return <DestinationShell destination={destination} />;
}
