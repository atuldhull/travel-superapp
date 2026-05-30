'use client';

import dynamic from 'next/dynamic';

const CompareShell = dynamic(async () => (await import('./compare-shell')).CompareShell, {
  ssr: false,
});

export function CompareLazy(): React.ReactElement {
  return <CompareShell />;
}
