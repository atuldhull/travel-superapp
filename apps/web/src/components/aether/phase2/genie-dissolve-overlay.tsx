'use client';

/**
 * AE412 — `<GenieDissolveOverlay>`.
 *
 * SVG particle swarm that swirls into the lower third when the Genie
 * modal opens and dissolves outward when it closes. Composes with the
 * AE406 modal: rendered behind the mic button but above the backdrop,
 * so the dust reads as "the surface dissolved into this swarm".
 *
 * `open` drives a forward animation; flipping it false drives the
 * reverse. When the reverse completes, `onClosed?.()` fires so the
 * parent can unmount the modal AFTER the dust has scattered.
 */
import { useEffect, useRef, useState } from 'react';
import {
  GENIE_DISSOLVE_MS,
  GENIE_PARTICLE_COUNT,
  canvasDimensions,
  particleAt,
  particleRadius,
} from './genie-particles';

export interface GenieDissolveOverlayProps {
  /** When true the swarm animates IN (t=0 → 1); when false it animates
   *  OUT (t=1 → 0) and fires `onClosed` when done. */
  readonly open: boolean;
  /** Fires when the close transition completes. Caller uses this to
   *  unmount the parent modal AFTER the dust has fully scattered. */
  readonly onClosed?: () => void;
  /** Override the particle count (Storybook + perf knobs). */
  readonly count?: number;
  /** Override the transition duration (tests). */
  readonly durationMs?: number;
  /** Fill colour (palette-derived). Default cream so it reads against
   *  the modal's dark backdrop. */
  readonly fill?: string;
}

export function GenieDissolveOverlay({
  open,
  onClosed,
  count = GENIE_PARTICLE_COUNT,
  durationMs = GENIE_DISSOLVE_MS,
  fill = 'var(--aether-palette-surface, #F2E8D5)',
}: GenieDissolveOverlayProps): React.ReactElement {
  const [progress, setProgress] = useState<number>(open ? 1 : 0);
  const [size, setSize] = useState<{ width: number; height: number }>(() =>
    typeof window === 'undefined'
      ? canvasDimensions(null, null)
      : canvasDimensions(window.innerWidth, window.innerHeight),
  );
  const startedAtRef = useRef<number | null>(null);
  const startProgressRef = useRef<number>(open ? 1 : 0);
  const targetProgressRef = useRef<number>(open ? 1 : 0);
  const rafRef = useRef<number | null>(null);

  // Track viewport resize so the swarm reflows. The modal is fullscreen
  // so we don't need to observe a specific container.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = (): void => {
      setSize(canvasDimensions(window.innerWidth, window.innerHeight));
    };
    window.addEventListener('resize', onResize);
    return (): void => window.removeEventListener('resize', onResize);
  }, []);

  // Drive the swirl-in / swirl-out animation when `open` flips.
  useEffect(() => {
    const target = open ? 1 : 0;
    targetProgressRef.current = target;
    startedAtRef.current = null;
    startProgressRef.current = progress;
    const step = (now: number): void => {
      if (startedAtRef.current === null) startedAtRef.current = now;
      const elapsed = now - startedAtRef.current;
      const t = Math.max(0, Math.min(1, elapsed / durationMs));
      const start = startProgressRef.current;
      const end = targetProgressRef.current;
      const next = start + (end - start) * t;
      setProgress(next);
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        if (end === 0) onClosed?.();
      }
    };
    if (typeof window === 'undefined') return undefined;
    rafRef.current = window.requestAnimationFrame(step);
    return (): void => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // We intentionally don't depend on `progress` — the closure captures
    // the start value once per flip; the rAF loop updates it from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, durationMs, onClosed]);

  const wrapStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 99, // Below the AE406 modal (zIndex 100) so the mic button stays interactive.
  };

  return (
    <svg
      data-aether-genie-dissolve
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${size.width} ${size.height}`}
      preserveAspectRatio="xMidYMid slice"
      style={wrapStyle}
    >
      {Array.from({ length: count }, (_, i) => {
        const pos = particleAt(i, progress, size.width, size.height, count);
        const r = particleRadius(i);
        return <circle key={i} cx={pos.x} cy={pos.y} r={r} fill={fill} opacity={pos.opacity} />;
      })}
    </svg>
  );
}
