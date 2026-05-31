'use client';

/**
 * AtlasShell — AetherProvider + theme override + <AtlasCanvas>.
 *
 * Phase 1 flag (AE379): swap the editorial Leaflet AtlasCanvas for the
 * R3F Compass Bird Surface (compass rose + cardinal markers + bearing
 * needle). Off by default — production keeps the editorial pin map.
 */
import { useMemo } from 'react';
import { AetherProvider } from '@app/aether-core';
import { theme as baseTheme, type Theme } from '@app/aether-motion';
import { AtlasCanvas } from './atlas-canvas';
import { Phase1CompassShell } from '../phase1';
import { Pulse } from '../pulse/pulse';
import { AetherA11yStyles } from '../aether-a11y-styles';

const PHASE1_ENABLED = process.env['NEXT_PUBLIC_FEATURE_AETHER_PHASE1'] === '1';

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
      <AetherA11yStyles />
      {PHASE1_ENABLED ? <Phase1CompassShell /> : <AtlasCanvas />}
      <Pulse />
    </AetherProvider>
  );
}
