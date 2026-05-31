/** Vitest specs for AE387 useLifecycleEvents hook. */
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurfaceManagerProvider, createSurfaceRegistry, useSurfaceManager } from '@app/aether-core';
import { type ReactNode } from 'react';
import {
  BREATHING_LIFECYCLE_PLAN,
  useLifecycleAutoDriver,
} from '../../src/components/aether/phase1/use-lifecycle-driver';
import {
  handlerKeyForPhase,
  useLifecycleEvents,
  type LifecycleEventHandlers,
} from '../../src/components/aether/phase1/use-lifecycle-events';

describe('handlerKeyForPhase (pure)', () => {
  it('maps each phase to its handler key', () => {
    expect(handlerKeyForPhase('idle')).toBe('onIdle');
    expect(handlerKeyForPhase('materialising')).toBe('onMaterialise');
    expect(handlerKeyForPhase('settling')).toBe('onSettle');
    expect(handlerKeyForPhase('listening')).toBe('onListen');
    expect(handlerKeyForPhase('dissolving')).toBe('onDissolve');
  });
});

function wrap(initialPathname = '/aether/drift'): React.FC<{ children: ReactNode }> {
  const registry = createSurfaceRegistry([
    {
      id: 'drift',
      phase: 1,
      route: { kind: 'literal', pathname: '/aether/drift' },
    },
  ]);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
        {children}
      </SurfaceManagerProvider>
    );
  };
}

describe('useLifecycleEvents (integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onIdle on first mount (initial phase = idle)', () => {
    const handlers = {
      onIdle: vi.fn(),
      onMaterialise: vi.fn(),
    } satisfies LifecycleEventHandlers;
    renderHook(() => useLifecycleEvents(handlers), { wrapper: wrap() });
    expect(handlers.onIdle).toHaveBeenCalledTimes(1);
    expect(handlers.onMaterialise).not.toHaveBeenCalled();
  });

  it('fires onMaterialise when the FSM advances', () => {
    const handlers = { onMaterialise: vi.fn() } satisfies LifecycleEventHandlers;
    renderHook(
      () => {
        useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);
        useLifecycleEvents(handlers);
      },
      { wrapper: wrap() },
    );
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    expect(handlers.onMaterialise).toHaveBeenCalledTimes(1);
  });

  it('walks through all 5 phases under BREATHING plan', () => {
    const handlers = {
      onIdle: vi.fn(),
      onMaterialise: vi.fn(),
      onSettle: vi.fn(),
      onListen: vi.fn(),
      onDissolve: vi.fn(),
    } satisfies LifecycleEventHandlers;
    renderHook(
      () => {
        useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);
        useLifecycleEvents(handlers);
      },
      { wrapper: wrap() },
    );
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
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.dissolvingMs + 1);
    });
    expect(handlers.onMaterialise).toHaveBeenCalledTimes(1);
    expect(handlers.onSettle).toHaveBeenCalledTimes(1);
    expect(handlers.onListen).toHaveBeenCalledTimes(1);
    expect(handlers.onDissolve).toHaveBeenCalledTimes(1);
    // onIdle fires on initial mount AND on the loop return from dissolving.
    expect(handlers.onIdle).toHaveBeenCalledTimes(2);
  });

  it('onAny fires with (next, prev) on every transition', () => {
    const onAny = vi.fn();
    renderHook(
      () => {
        useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);
        useLifecycleEvents({ onAny });
      },
      { wrapper: wrap() },
    );
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    expect(onAny).toHaveBeenCalledTimes(2); // initial + first transition
    // First call: initial mount (idle, null prev)
    expect(onAny.mock.calls[0]?.[0]).toBe('idle');
    expect(onAny.mock.calls[0]?.[1]).toBeNull();
    // Second call: idle → materialising
    expect(onAny.mock.calls[1]?.[0]).toBe('materialising');
    expect(onAny.mock.calls[1]?.[1]).toBe('idle');
  });

  it('inline-changed handlers fire the LATEST closure', () => {
    let counter = 0;
    const { result } = renderHook(
      () => {
        useLifecycleAutoDriver(BREATHING_LIFECYCLE_PLAN);
        useLifecycleEvents({
          onMaterialise: () => {
            counter += 1;
          },
        });
        return useSurfaceManager();
      },
      { wrapper: wrap() },
    );
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    expect(counter).toBe(1);
    // Force a remount to demonstrate the ref-based handler swap doesn't
    // double-fire.
    act(() => {
      result.current.setPhase('idle');
    });
    act(() => {
      vi.advanceTimersByTime(BREATHING_LIFECYCLE_PLAN.idleHoldMs + 1);
    });
    expect(counter).toBe(2);
  });

  it('omitting all handlers is a no-op (no throw)', () => {
    expect(() => renderHook(() => useLifecycleEvents({}), { wrapper: wrap() })).not.toThrow();
  });
});
