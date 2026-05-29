'use client';

import dynamic from 'next/dynamic';

const DispatchShell = dynamic(async () => (await import('./dispatch-shell')).DispatchShell, {
  ssr: false,
});

export function DispatchLazy(): React.ReactElement {
  return <DispatchShell />;
}
