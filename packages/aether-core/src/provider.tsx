/**
 * AetherProvider — single root component that mounts every Aether
 * runtime context in the correct order.
 *
 * Order matters:
 *   1. ThemeProvider (no dependencies)
 *   2. ReducedMotionProvider (no dependencies)
 *   3. PremiumProvider (no Aether dependencies; tier passed in by caller)
 *   4. PerceptionProvider (no Aether dependencies; Phase 0 stub)
 *   5. AudioEngineProvider (needs ReducedMotionProvider to read policy)
 *
 * Anything that consumes audio MUST be a descendant of AudioEngineProvider;
 * anything that consumes theme MUST be a descendant of ThemeProvider.
 */
import { type ReactNode } from 'react';
import type { Theme } from '@app/aether-motion';
import { ThemeProvider } from './theme';
import { ReducedMotionProvider, type MotionPolicy } from './reduced-motion';
import { PremiumProvider, type PremiumTier, type PremiumCapability } from './premium';
import { PerceptionProvider, type PerceptionState } from './perception';
import { AudioEngineProvider } from './audio-hooks';

export interface AetherProviderProps {
  children: ReactNode;
  /** Override the locked theme (Phase 6 destination palettes). */
  theme?: Theme;
  /** User's current premium tier (read from SDK in apps/web). null = anonymous. */
  premiumTier?: PremiumTier;
  /** Override the premium rule book if the default isn't right for the surface. */
  premiumResolve?: (tier: PremiumTier, capability: PremiumCapability) => boolean;
  /** Persistence callback for the user's motion override (settings page). */
  onMotionOverrideChange?: (next: MotionPolicy | null) => void;
  /** Initial motion override loaded from localStorage / User.audioOptOut. */
  initialMotionOverride?: MotionPolicy | null;
  /** Audio opt-out from settings. */
  audioOptOut?: boolean;
  /** Sample CDN origin (empty = relative). */
  sampleOrigin?: string;
  /** Real perception state — Phase 5+. */
  perceptionState?: PerceptionState;
}

export function AetherProvider({
  children,
  theme,
  premiumTier = null,
  premiumResolve,
  onMotionOverrideChange,
  initialMotionOverride = null,
  audioOptOut = false,
  sampleOrigin = '',
  perceptionState,
}: AetherProviderProps): React.ReactElement {
  return (
    <ThemeProvider {...(theme !== undefined ? { theme } : {})}>
      <ReducedMotionProvider
        initialOverride={initialMotionOverride}
        {...(onMotionOverrideChange !== undefined
          ? { onOverrideChange: onMotionOverrideChange }
          : {})}
      >
        <PremiumProvider
          tier={premiumTier}
          {...(premiumResolve !== undefined ? { resolve: premiumResolve } : {})}
        >
          <PerceptionProvider
            {...(perceptionState !== undefined ? { state: perceptionState } : {})}
          >
            <AudioEngineProvider optOut={audioOptOut} sampleOrigin={sampleOrigin}>
              {children}
            </AudioEngineProvider>
          </PerceptionProvider>
        </PremiumProvider>
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}
