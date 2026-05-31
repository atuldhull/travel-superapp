'use client';

import { useMemo } from 'react';
import { AetherProvider } from '@app/aether-core';
import { theme as baseTheme, type Theme } from '@app/aether-motion';
import { JourneyDashboard } from './journey-dashboard';
import { Phase1AtlasShell } from '../phase1';
import { Pulse } from '../pulse/pulse';
import { AetherA11yStyles } from '../aether-a11y-styles';

/**
 * Phase 1 flag (AE378): swap the editorial JourneyDashboard for the R3F
 * Atlas Surface (timeline + day markers + place orbs). Off by default so
 * production stays on the editorial preview.
 *
 * Read once at module evaluation so Fast Refresh doesn't flicker
 * between modes; restart the dev server to flip.
 */
const PHASE1_ENABLED = process.env['NEXT_PUBLIC_FEATURE_AETHER_PHASE1'] === '1';

export function JourneyShell({ tripId }: { tripId: string }): React.ReactElement {
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
      {PHASE1_ENABLED ? <Phase1AtlasShell tripId={tripId} /> : <JourneyDashboard tripId={tripId} />}
      <Pulse />
    </AetherProvider>
  );
}
