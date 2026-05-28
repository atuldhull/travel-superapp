'use client';

/**
 * DriftShell — mounts <AetherProvider> + <DriftCanvas>.
 *
 * Provider-level theme override: the locked Warm Italian font stacks
 * fall back to system serif/sans because Aether's design-DNA package
 * is pure tokens and can't import next/font (it would chain in Next's
 * server-only modules). apps/web loads Playfair Display + Inter via
 * next/font in app/layout.tsx and exposes them as the CSS variables
 * `--font-playfair` and `--font-inter` — we prepend those variables
 * to the locked stacks here so Drift actually renders in the
 * commissioned-feeling serif rather than Georgia.
 */
import { useMemo } from 'react';
import { AetherProvider } from '@app/aether-core';
import { theme as baseTheme, type Theme } from '@app/aether-motion';
import { DriftCanvas } from './drift-canvas';
import { Pulse } from './pulse/pulse';

export function DriftShell(): React.ReactElement {
  // Compose an apps/web-specific theme that prepends the next/font CSS
  // variables to the locked stacks. Storybook + tests still see the
  // raw tokens (no var() = no resolution = fallback) — production sees
  // the real Playfair/Inter.
  // Theme.font has `as const` literal-string types — widen via cast so
  // we can prepend the CSS variables. The Theme structural shape is
  // preserved; only the literal-type constraints relax.
  const theme = useMemo<Theme>(
    () =>
      ({
        ...baseTheme,
        font: {
          ...baseTheme.font,
          display: `var(--font-playfair), ${baseTheme.font.display}`,
          ui: `var(--font-inter), ${baseTheme.font.ui}`,
        },
      }) as unknown as Theme,
    [],
  );

  return (
    <AetherProvider premiumTier={null} audioOptOut={false} theme={theme}>
      <DriftCanvas />
      <Pulse />
    </AetherProvider>
  );
}
