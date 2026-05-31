'use client';

/**
 * <ReadingProgress> — sticky 2px terracotta bar at the very top
 * showing scroll progress through the page (AE66).
 *
 * Pinned to the top of the viewport at `z-index: sticky+1` so it
 * paints above DriftNav's glass. Uses `requestAnimationFrame` to
 * coalesce scroll events. Honours `prefers-reduced-motion` by
 * stripping the width-transition (the bar still updates).
 *
 * Pure presentational; consumers mount it once at the top of
 * long-form pages (journal articles, primarily).
 */
import { useEffect, useRef, useState } from 'react';
import { useMotionPolicy, useTheme } from '@app/aether-core';
// AE318 — canonical [0,1] clamp.
import { clamp01 } from '../../lib/clamp';

export function ReadingProgress(): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const [pct, setPct] = useState<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const compute = (): void => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const next = scrollHeight <= 0 ? 0 : clamp01(scrollTop / scrollHeight);
      setPct(next);
    };

    const onScroll = (): void => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        compute();
        rafRef.current = null;
      });
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const accent = theme.palette.terracotta;

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: theme.layer.sticky + 1,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          background: accent.base,
          boxShadow: `0 1px 4px ${accent.deep}`,
          transition:
            motionPolicy === 'full' ? 'width 120ms cubic-bezier(0.16, 0.84, 0.32, 1)' : 'none',
        }}
      />
    </div>
  );
}
