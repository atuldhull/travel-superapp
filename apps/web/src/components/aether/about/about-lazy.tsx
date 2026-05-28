'use client';

import dynamic from 'next/dynamic';

const AboutShell = dynamic(async () => (await import('./about-shell')).AboutShell, { ssr: false });

export function AboutLazy(): React.ReactElement {
  return <AboutShell />;
}
