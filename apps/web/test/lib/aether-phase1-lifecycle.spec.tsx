/**
 * Vitest specs for AE377/AE382 lifecycle auto-driver.
 *
 * Pure `nextScheduledPhase` + `nextPhaseInChain` + `phaseDelayFor` (no
 * React), then jsdom hook tests for the driver + AE382 breathing loop.
 */
// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurfaceManagerProvider, createSurfaceRegistry, useSurfaceManager } from '@app/aether-core';
import {
  BREATHING_LIFECYCLE_PLAN,
  DEFAULT_LIFECYCLE_PLAN,
  nextPhaseInChain,
  nextScheduledPhase,
  phaseDelayFor,
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

  it('listening + dissolving are terminal in DEFAULT plan (no loop)', () => {
    expect(nextScheduledPhase('listening', 99999, DEFAULT_LIFECYCLE_PLAN)).toBeNull();
    expect(nextScheduledPhase('dissolving', 99999, DEFAULT_LIFECYCLE_PLAN)).toBeNull();
  });
});

describe('BREATHING_LIFECYCLE_PLAN (AE382)', () => {
  it('extends DEFAULT with a listeningHoldMs of 8s', () => {
    expect(BREATHING_LIFECYCLE_PLAN.listeningHoldMs).toBe(8000);
    expect(BREATHING_LIFECYCLE_PLAN.idleHoldMs).toBe(DEFAULT_LIFECYCLE_PLAN.idleHoldMs);
    expect(BREATHING_LIFECYCLE_PLAN.materialisingMs).toBe(DEFAULT_LIFECYCLE_PLAN.materialisingMs);
  });

  it('keeps dissolvingMs from the default', () => {
    expect(BREATHING_LIFECYCLE_PLAN.dissolvingMs).toBe(500);
  });
});

describe('nextPhaseInChain — plan-aware', () => {
  it('listening is terminal in DEFAULT plan', () => {
    expect(nextPhaseInChain('listening', DEFAULT_LIFECYCLE_PLAN)).toBeNull();
  });

  it('listening advances to dissolving in BREATHING plan', () => {
    expect(nextPhaseInChain('listening', BREATHING_LIFECYCLE_PLAN)).toBe('dissolving');
  });

  it('dissolving is terminal in DEFAULT plan', () => {
    expect(nextPhaseInChain('dissolving', DEFAULT_LIFECYCLE_PLAN)).toBeNull();
  });

  it('dissolving advances to idle in BREATHING plan (loop closes)', () => {
    expect(nextPhaseInChain('dissolving', BREATHING_LIFECYCLE_PLAN)).toBe('idle');
  });

  it('forward steps are plan-invariant for idle/materialising/settling', () => {
    expect(nextPhaseInChain('idle', DEFAULT_LIFECYCLE_PLAN)).toBe('materialising');
    expect(nextPhaseInChain('idle', BREATHING_LIFECYCLE_PLAN)).toBe('materialising');
    expect(nextPhaseInChain('materialising', BREATHING_LIFECYCLE_PLAN)).toBe('settling');
    expect(nextPhaseInChain('settling', BREATHING_LIFECYCLE_PLAN)).toBe('listening');
  });
});

describe('phaseDelayFor', () => {
  it('returns the per-phase ms from the plan', () => {
    expect(phaseDelayFor('idle', DEFAULT_LIFECYCLE_PLAN)).toBe(60);
    expect(phaseDelayFor('materialising', DEFAULT_LIFECYCLE_PLAN)).toBe(700);
    expect(phaseDelayFor('settling', DEFAULT_LIFECYCLE_PLAN)).toBe(500);
    expect(phaseDelayFor('dissolving', DEFAULT_LIFECYCLE_PLAN)).toBe(500);
  });

  it('listening returns listeningHoldMs when set, 0 otherwise', () => {
    expect(phaseDelayFor('listening', DEFAULT_LIFECYCLE_PLAN)).toBe(0);
    expect(phaseDelayFor('listening', BREATHING_LIFECYCLE_PLAN)).toBe(8000);
  });
});

describe('nextScheduledPhase — BREATHING plan loop', () => {
  it('listening → dissolving after listeningHoldMs', () => {
    expect(nextScheduledPhase('listening', 0, BREATHING_LIFECYCLE_PLAN)).toBeNull();
    expect(nextScheduledPhase('listening', 7999, BREATHING_LIFECYCLE_PLAN)).toBeNull();
    expect(nextScheduledPhase('listening', 8000, BREATHING_LIFECYCLE_PLAN)).toBe('dissolving');
  });

  it('dissolving → idle after dissolvingMs', () => {
    expect(nextScheduledPhase('dissolving', 0, BREATHING_LIFECYCLE_PLAN)).toBeNull();
    expect(nextScheduledPhase('dissolving', 499, BREATHING_LIFECYCLE_PLAN)).toBeNull();
    expect(nextScheduledPhase('dissolving', 500, BREATHING_LIFECYCLE_PLAN)).toBe('idle');
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

describe('useLifecycleAutoDriver — BREATHING plan loop (AE382)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function wrapBreathing(): React.FC<{ children: React.ReactNode }> {
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

  it('listening dissolves after listeningHoldMs (loop opens)', () => {
    const Wrap = wrapBreathing();
    const { result } = renderHook(
      () => {
        useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);
        return useSurfaceManager();
      },
      { wrapper: Wrap },
    );
    // Walk into listening.
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.materialisingMs + 1);
    });
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.settlingMs + 1);
    });
    expect(result.current.phase).toBe('listening');
    // Hold timer.
    act(() => {
      vi.advanceTimersByTime((BREATHING_LIFECYCLE_PLAN.listeningHoldMs ?? 0) + 1);
    });
    expect(result.current.phase).toBe('dissolving');
  });

  it('full breath closes back to idle then re-materialises', () => {
    const Wrap = wrapBreathing();
    const { result } = renderHook(
      () => {
        useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);
        return useSurfaceManager();
      },
      { wrapper: Wrap },
    );
    // idle -> materialising -> settling -> listening -> dissolving -> idle
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.materialisingMs + 1);
    });
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.settlingMs + 1);
    });
    act(() => {
      vi.advanceTimersByTime((BREATHING_LIFECYCLE_PLAN.listeningHoldMs ?? 0) + 1);
    });
    expect(result.current.phase).toBe('dissolving');
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.dissolvingMs + 1);
    });
    expect(result.current.phase).toBe('idle');
    // Next idle hold should take us back into materialising — the loop
    // is closed.
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    expect(result.current.phase).toBe('materialising');
  });

  it('DEFAULT plan still stops at listening (AE377 default unchanged)', () => {
    const Wrap = wrapBreathing();
    const { result } = renderHook(
      () => {
        useLifecycleAutoDriver(DEFAULT_LIFECYCLE_PLAN);
        return useSurfaceManager();
      },
      { wrapper: Wrap },
    );
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
});
