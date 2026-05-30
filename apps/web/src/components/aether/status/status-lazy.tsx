'use client';

import dynamic from 'next/dynamic';

const StatusShell = dynamic(async () => (await import('./status-shell')).StatusShell, {
  ssr: false,
});

export function StatusLazy(): React.ReactElement {
  return <StatusShell />;
}
