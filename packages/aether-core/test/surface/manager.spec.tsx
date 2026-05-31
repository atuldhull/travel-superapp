/** AE374 — SurfaceManagerProvider + hook trio specs. */
import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  SurfaceManagerProvider,
  useCurrentSurface,
  useSurfaceLifecycle,
  useSurfaceManager,
} from '../../src/surface/manager';
import { createSurfaceRegistry } from '../../src/surface/registry';
import type { Surface } from '../../src/surface/types';

const drift: Surface = {
  id: 'drift',
  phase: 1,
  route: { kind: 'literal', pathname: '/aether' },
};
const atlas: Surface = {
  id: 'atlas',
  phase: 1,
  route: { kind: 'pattern', pathname: '/aether/journey/:id' },
};
const pulse: Surface = {
  id: 'pulse',
  phase: 1,
  route: { kind: 'overlay' },
};

function wrap(initialPathname = '/aether'): React.FC<{ children: ReactNode }> {
  const registry = createSurfaceRegistry([drift, atlas, pulse]);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
        {children}
      </SurfaceManagerProvider>
    );
  };
}

describe('useSurfaceManager — outside provider', () => {
  it('throws a helpful message', () => {
    // Silence the expected React error log; jsdom would otherwise print
    // a noisy stack from the rendered hook.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSurfaceManager())).toThrow(/outside <SurfaceManagerProvider>/);
    spy.mockRestore();
  });
});

describe('useCurrentSurface', () => {
  it('returns the route-bound surface for the initial pathname', () => {
    const { result } = renderHook(() => useCurrentSurface(), {
      wrapper: wrap('/aether'),
    });
    expect(result.current?.id).toBe('drift');
  });

  it('returns null when no surface matches', () => {
    const { result } = renderHook(() => useCurrentSurface(), {
      wrapper: wrap('/somewhere-else'),
    });
    expect(result.current).toBeNull();
  });

  it('matches pattern routes', () => {
    const { result } = renderHook(() => useCurrentSurface(), {
      wrapper: wrap('/aether/journey/abc123'),
    });
    expect(result.current?.id).toBe('atlas');
  });
});

describe('useSurfaceLifecycle', () => {
  it("starts at 'idle'", () => {
    const { result } = renderHook(() => useSurfaceLifecycle(), {
      wrapper: wrap('/aether'),
    });
    expect(result.current).toBe('idle');
  });

  it("forces 'idle' when no surface is current, regardless of phase override", () => {
    const { result } = renderHook(() => ({ p: useSurfaceLifecycle(), m: useSurfaceManager() }), {
      wrapper: wrap('/nowhere'),
    });
    act(() => result.current.m.setPhase('listening'));
    expect(result.current.p).toBe('idle');
  });
});

describe('setRoute', () => {
  it('updates current + resets phase to idle', () => {
    const { result } = renderHook(() => useSurfaceManager(), {
      wrapper: wrap('/aether'),
    });
    act(() => result.current.setPhase('materialising'));
    expect(result.current.phase).toBe('materialising');
    act(() => result.current.setRoute('/aether/journey/foo'));
    expect(result.current.current?.id).toBe('atlas');
    expect(result.current.phase).toBe('idle');
  });

  it('non-matching pathname → current becomes null', () => {
    const { result } = renderHook(() => useSurfaceManager(), {
      wrapper: wrap('/aether'),
    });
    act(() => result.current.setRoute('/no-surface-here'));
    expect(result.current.current).toBeNull();
  });
});

describe('setPhase', () => {
  it('updates phase when a surface is current', () => {
    const { result } = renderHook(() => useSurfaceManager(), {
      wrapper: wrap('/aether'),
    });
    act(() => result.current.setPhase('materialising'));
    expect(result.current.phase).toBe('materialising');
    act(() => result.current.setPhase('listening'));
    expect(result.current.phase).toBe('listening');
  });
});

describe('anticipate', () => {
  it("starts null and tracks the predictor's guess", () => {
    const { result } = renderHook(() => useSurfaceManager(), {
      wrapper: wrap('/aether'),
    });
    expect(result.current.anticipating).toBeNull();
    act(() => result.current.anticipate('atlas'));
    expect(result.current.anticipating).toBe('atlas');
    act(() => result.current.anticipate(null));
    expect(result.current.anticipating).toBeNull();
  });
});

describe('overlays', () => {
  it('always exposes the overlay surfaces', () => {
    const { result } = renderHook(() => useSurfaceManager(), {
      wrapper: wrap('/aether'),
    });
    expect(result.current.overlays.map((s) => s.id)).toEqual(['pulse']);
  });

  it('overlays stay present even when no route matches', () => {
    const { result } = renderHook(() => useSurfaceManager(), {
      wrapper: wrap('/nope'),
    });
    expect(result.current.current).toBeNull();
    expect(result.current.overlays.map((s) => s.id)).toEqual(['pulse']);
  });
});

describe('SurfaceManagerProvider — rendering', () => {
  it('renders children', () => {
    const registry = createSurfaceRegistry([drift]);
    const { getByText } = render(
      <SurfaceManagerProvider registry={registry} initialPathname="/aether">
        <span>visible</span>
      </SurfaceManagerProvider>,
    );
    expect(getByText('visible')).toBeTruthy();
  });
});
