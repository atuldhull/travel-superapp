'use client';

/**
 * DriftShell — mounts <AetherProvider> + <DriftCanvas>.
 *
 * Kept separate from the canvas so the provider tree is testable
 * independently of R3F + Tone.js. Also lets us swap the provider
 * config without re-rendering the heavy canvas.
 */
import { AetherProvider } from '@app/aether-core';
import { DriftCanvas } from './drift-canvas';

export function DriftShell(): React.ReactElement {
  return (
    <AetherProvider premiumTier={null} audioOptOut={false}>
      <DriftCanvas />
    </AetherProvider>
  );
}
