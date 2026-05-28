'use client';

/**
 * useViewport — returns whether the viewport is narrow (mobile) +
 * (tablet) live as the user resizes / rotates.
 *
 * Aether components use inline styles for token discipline, so this
 * hook is how we conditionally pick between mobile + desktop layouts
 * without resorting to global CSS classes. SSR-safe — initial value
 * is `{ isNarrow: false, isMid: false }` (desktop assumption); the
 * first effect tick corrects it on hydration.
 *
 * Breakpoints:
 *   • narrow  ≤ 640px (phones)
 *   • mid     641 – 960px (tablets / split-screen)
 *   • else    desktop
 */
import { useEffect, useState } from 'react';

export interface Viewport {
  readonly isNarrow: boolean;
  readonly isMid: boolean;
}

const DEFAULT: Viewport = { isNarrow: false, isMid: false };

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(DEFAULT);

  useEffect(() => {
    const compute = (): Viewport => {
      if (typeof window === 'undefined') return DEFAULT;
      const w = window.innerWidth;
      return {
        isNarrow: w <= 640,
        isMid: w > 640 && w <= 960,
      };
    };
    setVp(compute());
    const handler = (): void => setVp(compute());
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  return vp;
}
