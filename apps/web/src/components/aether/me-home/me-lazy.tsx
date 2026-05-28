'use client';

import dynamic from 'next/dynamic';

const MeShell = dynamic(async () => (await import('./me-shell')).MeShell, { ssr: false });

export function MeLazy(): React.ReactElement {
  return <MeShell />;
}
