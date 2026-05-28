'use client';

/**
 * DestinationShell — mounts <AetherProvider> with the Drift theme
 * override (same next/font swap as DriftShell), then renders the
 * destination page.
 */
import { useMemo } from 'react';
import { AetherProvider } from '@app/aether-core';
import { theme as baseTheme, type Theme } from '@app/aether-motion';
import { DestinationPage } from './destination-page';
import { type Destination } from './data';

export function DestinationShell({
  destination,
}: {
  destination: Destination;
}): React.ReactElement {
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
      <DestinationPage destination={destination} />
    </AetherProvider>
  );
}
