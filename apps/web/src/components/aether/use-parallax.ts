'use client';

/**
 * useParallax — returns a transform style string driven by window scroll.
 *
 * Cheap. Reads scrollY in a rAF loop only while the page is actually
 * scrolling (passive listener). No state updates from inside scroll —
 * the transform is written directly to a ref to avoid React reconciliation.
 *
 * Honors `prefers-reduced-motion` via the Aether motion policy hook —
 * when motion is essential or none, the parallax silently returns ''.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { useMotionPolicy } from '@app/aether-core';
// AE343 — shared clamp (was inline Math.max/Math.min).
import { clamp } from '../../lib/clamp';

export interface UseParallaxOptions {
  /** Speed multiplier. 0.4 = element moves 40% as fast as scroll. */
  readonly speed?: number;
  /** Direction. 'translateY' (default) or 'translateX' or a custom builder. */
  readonly axis?: 'y' | 'x';
  /** Max offset in px to clamp the transform — prevents going off-screen. */
  readonly maxOffset?: number;
}

export function useParallax<T extends HTMLElement = HTMLDivElement>(
  options: UseParallaxOptions = {},
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const motionPolicy = useMotionPolicy();
  const speed = options.speed ?? 0.4;
  const axis = options.axis ?? 'y';
  const maxOffset = options.maxOffset ?? 240;

  useEffect(() => {
    if (motionPolicy !== 'full') return;
    const node = ref.current;
    if (node === null) return;

    let raf = 0;
    let pending = false;

    const apply = (): void => {
      pending = false;
      if (ref.current === null) return;
      // Element's offset relative to viewport: positive when below the
      // fold, negative when scrolled past. We want the element to drift
      // up slower than scroll, so subtract speed * scrollY.
      const rect = ref.current.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const viewportCenter = window.innerHeight / 2;
      // Distance of element-center from viewport-center, in pixels.
      const distance = center - viewportCenter;
      // Negate so element drifts UP as you scroll down (classic parallax).
      const raw = -distance * speed;
      const clamped = clamp(raw, -maxOffset, maxOffset);
      const tx =
        axis === 'x' ? `translate3d(${clamped}px, 0, 0)` : `translate3d(0, ${clamped}px, 0)`;
      ref.current.style.transform = tx;
    };

    const onScroll = (): void => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [motionPolicy, speed, axis, maxOffset]);

  return ref;
}
