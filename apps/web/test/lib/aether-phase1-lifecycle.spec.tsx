/**
 * Vitest specs for AE377 lifecycle auto-driver.
 *
 * Pure `nextScheduledPhase` first (no React), then a jsdom hook test that
 * confirms idle → materialising fires inside the driver after the wait.
 */
// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurfaceManagerProvider, createSurfaceRegistry, useSurfaceManager } from '@app/aether-core';
import {
  DEFAULT_LIFECYCLE_PLAN,
  nextScheduledPhase,
  useLifecycleAutoDriver,
} from '../../src/components/aether/phase1/use-lifecycle-driver';

describe('nextScheduledPhase', () => {
  it('idle holds until idleHoldMs elapses, then advances to materialising', () => {
    expect(nextScheduledPhase('idle', 0, DEFAULT_LIFECYCLE_PLAN)).toBeNull();
    expect(
      nextScheduledPhase('idle', DEFAULT_LIFECYCLE_PLAN.idleHoldMs - 1, DEFAULT_LIFECYCLE_PLAN),
    ).toBeNull();
    expect(
      nextScheduledPhase('idle', DEFAULT_LIFECYCLE_PLAN.idleHoldMs, DEFAULT_LIFECYCLE_PLAN),
    ).toBe('materialising');
  });

  it('materialising holds, then advances to settling', () => {
    expect(
      nextScheduledPhase(
        'materialising',
        DEFAULT_LIFECYCLE_PLAN.materialisingMs - 1,
        DEFAULT_LIFECYCLE_PLAN,
      ),
    ).toBeNull();
    expect(
      nextScheduledPhase(
        'materialising',
        DEFAULT_LIFECYCLE_PLAN.materialisingMs,
        DEFAULT_LIFECYCLE_PLAN,
      ),
    ).toBe('settling');
  });

  it('settling holds, then advances to listening', () => {
    expect(
      nextScheduledPhase('settling', DEFAULT_LIFECYCLE_PLAN.settlingMs - 1, DEFAULT_LIFECYCLE_PLAN),
    ).toBeNull();
    expect(
      nextScheduledPhase('settling', DEFAULT_LIFECYCLE_PLAN.settlingMs, DEFAULT_LIFECYCLE_PLAN),
    ).toBe('listening');
  });

  it('listening + dissolving are terminal (no auto-advance)', () => {
    expect(nextScheduledPhase('listening', 99999, DEFAULT_LIFECYCLE_PLAN)).toBeNull();
    expect(nextScheduledPhase('dissolving', 99999, DEFAULT_LIFECYCLE_PLAN)).toBeNull();
  });
});

describe('useLifecycleAutoDriver — integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function wrap(): React.FC<{ children: React.ReactNode }> {
    const registry = createSurfaceRegistry([
      {
        id: 'drift',
        phase: 1,
        route: { kind: 'literal', pathname: '/aether/drift' },
      },
    ]);
    return function Wrap({ children }) {
      return (
        <SurfaceManagerProvider registry={registry} initialPathname="/aether/drift">
          {children}
        </SurfaceManagerProvider>
      );
    };
  }

  it('advances idle → materialising after the idleHold timer', () => {
    const Wrap = wrap();
    const { result } = renderHook(
      () => {
        useLifecycleAutoDriver();
        return useSurfaceManager();
      },
      { wrapper: Wrap },
    );
    expect(result.current.phase).toBe('idle');
    act(() => {
      vi.advanceTimersByTime(DEFAULT_LIFECYCLE_PLAN.idleHoldMs + 5);
    });
    expect(result.current.phase).toBe('materialising');
  });

  it('eventually settles into listening after the full chain', () => {
    const Wrap = wrap();
    const { result } = renderHook(
      () => {
        useLifecycleAutoDriver();
        return useSurfaceManager();
      },
      { wrapper: Wrap },
    );
    // Each phase needs its own act() flush so React commits setPhase()
    // before the effect can register the NEXT setTimeout. Bundling all
    // advances into a single act() leaves the subsequent timers unset.
    act(() => {
      vi.advanceTimersByTime(DEFAULT_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    expect(result.current.phase).toBe('materialising');
    act(() => {
      vi.advanceTimersByTime(DEFAULT_LIFECYCLE_PLAN.materialisingMs + 1);
    });
    expect(result.current.phase).toBe('settling');
    act(() => {
      vi.advanceTimersByTime(DEFAULT_LIFECYCLE_PLAN.settlingMs + 1);
    });
    expect(result.current.phase).toBe('listening');
  });

  it('listening is steady-state (no further auto-advance)', () => {
    const Wrap = wrap();
    const { result } = renderHook(
      () => {
        useLifecycleAutoDriver();
        return useSurfaceManager();
      },
      { wrapper: Wrap },
    );
    // Walk into listening with one act() per phase boundary.
    act(() => {
      vi.advanceTimersByTime(DEFAULT_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    act(() => {
      vi.advanceTimersByTime(DEFAULT_LIFECYCLE_PLAN.materialisingMs + 1);
    });
    act(() => {
      vi.advanceTimersByTime(DEFAULT_LIFECYCLE_PLAN.settlingMs + 1);
    });
    expect(result.current.phase).toBe('listening');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.phase).toBe('listening');
  });

  it('does not run when no surface is current', () => {
    const Wrap = ({ children }: { children: React.ReactNode }): React.ReactElement => {
      const registry = createSurfaceRegistry([
        {
          id: 'drift',
          phase: 1,
          route: { kind: 'literal', pathname: '/aether/drift' },
        },
      ]);
      return (
        <SurfaceManagerProvider registry={registry} initialPathname="/nope">
          {children}
        </SurfaceManagerProvider>
      );
    };
    const { result } = renderHook(
      () => {
        useLifecycleAutoDriver();
        return useSurfaceManager();
      },
      { wrapper: Wrap },
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.current).toBeNull();
    expect(result.current.phase).toBe('idle');
  });

  it('renders children without throwing (smoke)', () => {
    const Wrap = wrap();
    const { container } = render(
      <Wrap>
        <span data-testid="ok">ok</span>
      </Wrap>,
    );
    expect(container.querySelector('[data-testid="ok"]')).toBeTruthy();
  });
});
