'use client';

import dynamic from 'next/dynamic';

const BrandShell = dynamic(async () => (await import('./brand-shell')).BrandShell, {
  ssr: false,
});

export function BrandLazy(): React.ReactElement {
  return <BrandShell />;
}
