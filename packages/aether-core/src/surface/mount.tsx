/**
 * `<SurfaceMountFrame>` — the slot where the active Surface renders.
 *
 * AE374 ships the contract: read the current Surface from the manager,
 * lazy-load its `mount` factory, and render the resulting component with
 * a `<Suspense>` fallback.
 *
 * AE375 (@app/aether-canvas) provides the first real `mount` (R3F Drift
 * particle field). Until then, Surfaces without a `mount` show a soft
 * placeholder so the route still renders end-to-end. The placeholder is
 * also what `prefers-reduced-motion: reduce` will collapse to, so the
 * AE374 fallback is intentionally calm — not a "this is broken" hint.
 *
 * Why a Web Component is NOT used here yet: 01-architecture.md mentions
 * a light-DOM Web Component to persist Pulse across navigations. That
 * belongs in `@app/aether-canvas`' Pulse implementation, not in this
 * generic mount frame. AE374 frames the slot only.
 */
import {
  Suspense,
  lazy,
  useMemo,
  type ComponentType,
  type CSSProperties,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { useSurfaceManager } from './manager';
import type { Surface, SurfaceMountProps } from './types';

export interface SurfaceMountFrameProps {
  /**
   * Override the placeholder shown while the scene chunk is loading OR
   * when the Surface has no `mount`. Defaults to a calm centered card.
   */
  fallback?: ReactNode;
  /** Optional CSS background applied to the frame; defaults to inheriting. */
  background?: string;
  /**
   * Optional override for which Surface to render. Storybook passes one
   * directly; apps/web reads from the manager (default).
   */
  surface?: Surface;
}

export function SurfaceMountFrame({
  fallback,
  background,
  surface,
}: SurfaceMountFrameProps): React.ReactElement {
  const manager = useSurfaceManager();
  const active = surface ?? manager.current;

  const Lazy = useMemo<LazyExoticComponent<ComponentType<SurfaceMountProps>> | null>(() => {
    if (active === undefined || active === null) return null;
    if (active.mount === undefined) return null;
    return lazy(active.mount);
  }, [active]);

  const frameStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100%',
    ...(background !== undefined ? { background } : {}),
  };

  const placeholder = fallback ?? <DefaultPlaceholder />;

  if (active === null) {
    return (
      <div data-aether-surface="empty" data-testid="aether-surface-empty" style={frameStyle}>
        {placeholder}
      </div>
    );
  }

  if (Lazy === null) {
    return (
      <div
        data-aether-surface={active.id}
        data-aether-phase={manager.phase}
        data-testid="aether-surface-placeholder"
        style={frameStyle}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div
      data-aether-surface={active.id}
      data-aether-phase={manager.phase}
      data-testid="aether-surface-mounted"
      style={frameStyle}
    >
      <Suspense fallback={placeholder}>
        <Lazy surface={active} phase={manager.phase} />
      </Suspense>
    </div>
  );
}

/** Calm centered placeholder — neutral colors so it slots into any host
 *  theme without clashing. AE375 swaps this for an R3F Drift scene. */
function DefaultPlaceholder(): React.ReactElement {
  return (
    <div
      role="presentation"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 240,
        padding: 32,
        color: 'rgba(0, 0, 0, 0.45)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      <span aria-hidden>·</span>
    </div>
  );
}
