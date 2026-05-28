'use client';

import dynamic from 'next/dynamic';

const AtlasShell = dynamic(async () => (await import('./atlas-shell')).AtlasShell, { ssr: false });

export function AtlasLazy(): React.ReactElement {
  return <AtlasShell />;
}
