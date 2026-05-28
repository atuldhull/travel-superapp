'use client';

import dynamic from 'next/dynamic';

const PlanShell = dynamic(async () => (await import('./plan-shell')).PlanShell, { ssr: false });

export function PlanLazy(): React.ReactElement {
  return <PlanShell />;
}
