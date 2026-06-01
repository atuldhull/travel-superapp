/**
 * `useReducedMotionNative()` — Phase 4 mobile AE532.
 *
 * The native analog of the web's `prefers-reduced-motion` media query
 * (the web Aether shells read it via `window.matchMedia`). On
 * iOS/Android there is no CSS media query — the equivalent OS signal is
 * `AccessibilityInfo.isReduceMotionEnabled()` plus the
 * `'reduceMotionChanged'` event.
 *
 * Aether mobile surfaces accept a `reducedMotion` prop (see
 * `apps/mobile/src/aether/pulse-glow.tsx`, where it disables the
 * `requestAnimationFrame` breathing loop and paints a static
 * mid-range envelope instead). This hook is the canonical feed for
 * that prop: mount it once near the surface root and thread the result
 * down so every Aether surface honours the OS Reduce Motion setting in
 * lock-step.
 *
 * State defaults to `false` until the first async read resolves, then
 * tracks live changes via the subscription. The
 * `AccessibilityInfo.addEventListener` subscription returns an
 * `EmitterSubscription`; we `.remove()` it on unmount.
 *
 * Installed by AE532.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotionNative(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    // Initial async read — resolves the OS setting at mount time.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled: boolean) => {
        if (!cancelled) setReducedMotion(enabled);
      })
      .catch(() => {
        if (!cancelled) setReducedMotion(false);
      });

    // Live updates while mounted (user toggles Reduce Motion in OS settings).
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        if (!cancelled) setReducedMotion(enabled);
      },
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
