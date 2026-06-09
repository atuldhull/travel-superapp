'use client';

/**
 * Lazy boundary for <CommandPalette>. cmdk + @tanstack/react-query only
 * matter once the user opens the palette (Cmd/Ctrl+K). ssr:false keeps them
 * off the shared baseline; the open-shortcut listener registers on mount.
 */
import dynamic from 'next/dynamic';

export const CommandPalette = dynamic(
  async () => (await import('./command-palette')).CommandPalette,
  { ssr: false },
);
