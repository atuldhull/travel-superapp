'use client';

import { useMemo } from 'react';
import { AetherProvider } from '@app/aether-core';
import { theme as baseTheme, type Theme } from '@app/aether-motion';
import { DestinationsIndex } from './destinations-index';
import { Pulse } from '../pulse/pulse';
import { AetherA11yStyles } from '../aether-a11y-styles';

export function DestinationsIndexShell(): React.ReactElement {
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
      <AetherA11yStyles />
      <DestinationsIndex />
      <Pulse />
    </AetherProvider>
  );
}
