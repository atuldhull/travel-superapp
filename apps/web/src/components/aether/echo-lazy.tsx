'use client';

/**
 * AE418 — client-side lazy boundary for the Phase 3 Echo surface.
 *
 * Same pattern as `vault-lazy.tsx` / `memory-lazy.tsx`:
 * `dynamic(..., ssr: false)` inside a Client Component so Next 15's
 * server-component dynamic-import restrictions stay happy.
 */
import dynamic from 'next/dynamic';

const Phase3EchoShellLazy = dynamic(
  async () => (await import('./phase3/phase3-echo-shell')).Phase3EchoShell,
  { ssr: false },
);

export function EchoLazy(): React.ReactElement {
  return <Phase3EchoShellLazy />;
}
