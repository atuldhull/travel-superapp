'use client';

/**
 * Client-side lazy boundary for the Phase 2 Lumen surface.
 *
 * Mirrors `drift-lazy.tsx` — Next 15 disallows `ssr: false` from Server
 * Components, so the dynamic-with-ssr-false has to live in a Client
 * Component. The same flag gate (`NEXT_PUBLIC_FEATURE_AETHER_PHASE1`)
 * unlocks Phase 2 surfaces for now — Phase 2 doesn't get its own env
 * var until the memory book + Genie + Vault triad ships as a real
 * milestone.
 */
import dynamic from 'next/dynamic';

const Phase2LumenShellLazy = dynamic(
  async () => (await import('./phase2/phase2-lumen-shell')).Phase2LumenShell,
  { ssr: false },
);

export function MemoryLazy({ bookId }: { bookId: string }): React.ReactElement {
  return <Phase2LumenShellLazy bookId={bookId} />;
}
