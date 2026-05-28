'use client';

import dynamic from 'next/dynamic';

const SharesShell = dynamic(async () => (await import('./shares-shell')).SharesShell, {
  ssr: false,
});

export function SharesLazy(): React.ReactElement {
  return <SharesShell />;
}
