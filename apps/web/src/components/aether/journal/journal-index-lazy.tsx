'use client';

import dynamic from 'next/dynamic';

const JournalIndexShell = dynamic(
  async () => (await import('./journal-index-shell')).JournalIndexShell,
  { ssr: false },
);

export function JournalIndexLazy(): React.ReactElement {
  return <JournalIndexShell />;
}
