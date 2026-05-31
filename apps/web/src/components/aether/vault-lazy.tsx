'use client';

/**
 * Client-side lazy boundary for the Phase 2 Vault surface.
 *
 * Same pattern as `memory-lazy.tsx` — `dynamic(..., ssr: false)`
 * inside a Client Component since Next 15 forbids it on Server
 * Components.
 */
import dynamic from 'next/dynamic';

const Phase2VaultShellLazy = dynamic(
  async () => (await import('./phase2/phase2-vault-shell')).Phase2VaultShell,
  { ssr: false },
);

export function VaultLazy(): React.ReactElement {
  return <Phase2VaultShellLazy />;
}
