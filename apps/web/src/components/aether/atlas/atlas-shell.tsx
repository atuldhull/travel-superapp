'use client';

/**
 * AtlasShell — AetherProvider + theme override + <AtlasCanvas>.
 */
import { useMemo } from 'react';
import { AetherProvider } from '@app/aether-core';
import { theme as baseTheme, type Theme } from '@app/aether-motion';
import { AtlasCanvas } from './atlas-canvas';

export function AtlasShell(): React.ReactElement {
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
      <AtlasCanvas />
    </AetherProvider>
  );
}
