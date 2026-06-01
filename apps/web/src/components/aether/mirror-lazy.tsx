'use client';

/**
 * AE421 — client-side lazy boundary for the Phase 3 Mirror surface.
 *
 * Same pattern as the other Phase 1+ lazy boundaries.
 */
import dynamic from 'next/dynamic';

const Phase3MirrorShellLazy = dynamic(
  async () => (await import('./phase3/phase3-mirror-shell')).Phase3MirrorShell,
  { ssr: false },
);

export function MirrorLazy(): React.ReactElement {
  return <Phase3MirrorShellLazy />;
}
