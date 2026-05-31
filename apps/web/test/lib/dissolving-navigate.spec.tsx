/**
 * Vitest specs for AE383 navigation-triggered dissolve.
 *
 * Pure `delayedNavigate` first (no React), then jsdom tests for
 * `useDissolvingNavigate` + `<DissolvingLink>`.
 */
// @vitest-environment jsdom
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { SurfaceManagerProvider, createSurfaceRegistry, useSurfaceManager } from '@app/aether-core';
import {
  DEFAULT_DISSOLVE_MS,
  delayedNavigate,
  useDissolvingNavigate,
} from '../../src/components/aether/phase1/dissolving-navigate';
import { DissolvingLink, isInAppClick } from '../../src/components/aether/phase1/dissolving-link';

// Next's router hook is mocked so we don't have to mount a real
// Next app router. The mock returns a spy push + replace.
const pushSpy = vi.fn();
const replaceSpy = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
  usePathname: () => '/aether/drift',
}));

// Next's Link is mocked to render a plain anchor so onClick interception
// is observable in jsdom.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...(rest as Record<string, unknown>)}>
      {children}
    </a>
  ),
}));

describe('delayedNavigate (pure)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires setPhase("dissolving") synchronously', () => {
    const setPhase = vi.fn();
    const navigate = vi.fn();
    delayedNavigate(setPhase, navigate, 500);
    expect(setPhase).toHaveBeenCalledWith('dissolving');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('schedules navigate after the dissolve duration', () => {
    const setPhase = vi.fn();
    const navigate = vi.fn();
    delayedNavigate(setPhase, navigate, 500);
    vi.advanceTimersByTime(499);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('returns a cancel that clears the pending navigation', () => {
    const setPhase = vi.fn();
    const navigate = vi.fn();
    const cancel = delayedNavigate(setPhase, navigate, 500);
    cancel();
    vi.advanceTimersByTime(2000);
    expect(navigate).not.toHaveBeenCalled();
    // setPhase still fired — the dissolve has already begun, only the
    // route swap was cancelled.
    expect(setPhase).toHaveBeenCalledWith('dissolving');
  });

  it('dissolveMs=0 navigates on the next microtask tick', () => {
    const setPhase = vi.fn();
    const navigate = vi.fn();
    delayedNavigate(setPhase, navigate, 0);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('dissolveMs<0 also defers to setTimeout(0)', () => {
    const setPhase = vi.fn();
    const navigate = vi.fn();
    delayedNavigate(setPhase, navigate, -1);
    vi.advanceTimersByTime(1);
    expect(navigate).toHaveBeenCalledOnce();
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

describe('useDissolvingNavigate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushSpy.mockClear();
    replaceSpy.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('push() sets phase to dissolving + calls router.push after delay', () => {
    const { result } = renderHook(
      () => ({ nav: useDissolvingNavigate(), mgr: useSurfaceManager() }),
      { wrapper: wrap() },
    );
    act(() => result.current.nav.push('/elsewhere'));
    expect(result.current.mgr.phase).toBe('dissolving');
    expect(pushSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(DEFAULT_DISSOLVE_MS + 1);
    });
    expect(pushSpy).toHaveBeenCalledWith('/elsewhere');
  });

  it('replace() uses router.replace', () => {
    const { result } = renderHook(() => useDissolvingNavigate(), { wrapper: wrap() });
    act(() => result.current.replace('/elsewhere'));
    act(() => {
      vi.advanceTimersByTime(DEFAULT_DISSOLVE_MS + 1);
    });
    expect(replaceSpy).toHaveBeenCalledWith('/elsewhere');
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('rapid double-push only navigates to the latest target', () => {
    const { result } = renderHook(() => useDissolvingNavigate(), { wrapper: wrap() });
    act(() => result.current.push('/first'));
    act(() => result.current.push('/second'));
    act(() => {
      vi.advanceTimersByTime(DEFAULT_DISSOLVE_MS + 1);
    });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith('/second');
  });

  it('honours custom dissolveMs', () => {
    const { result } = renderHook(() => useDissolvingNavigate(120), { wrapper: wrap() });
    act(() => result.current.push('/elsewhere'));
    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(pushSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(pushSpy).toHaveBeenCalledWith('/elsewhere');
  });

  it('unmount cancels the pending navigation', () => {
    const { result, unmount } = renderHook(() => useDissolvingNavigate(), {
      wrapper: wrap(),
    });
    act(() => result.current.push('/elsewhere'));
    unmount();
    act(() => {
      vi.advanceTimersByTime(DEFAULT_DISSOLVE_MS + 100);
    });
    expect(pushSpy).not.toHaveBeenCalled();
  });
});

describe('isInAppClick', () => {
  function makeEvent(
    overrides: Partial<{
      button: number;
      metaKey: boolean;
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      defaultPrevented: boolean;
      target: string;
    }> = {},
  ): React.MouseEvent<HTMLAnchorElement> {
    const anchor = document.createElement('a');
    if (overrides.target !== undefined) anchor.setAttribute('target', overrides.target);
    return {
      button: overrides.button ?? 0,
      metaKey: overrides.metaKey ?? false,
      ctrlKey: overrides.ctrlKey ?? false,
      shiftKey: overrides.shiftKey ?? false,
      altKey: overrides.altKey ?? false,
      defaultPrevented: overrides.defaultPrevented ?? false,
      currentTarget: anchor,
    } as unknown as React.MouseEvent<HTMLAnchorElement>;
  }

  it('left click + no modifier = in-app', () => {
    expect(isInAppClick(makeEvent())).toBe(true);
  });

  it('right click is not in-app', () => {
    expect(isInAppClick(makeEvent({ button: 2 }))).toBe(false);
  });

  it('Cmd/Ctrl/Shift/Alt clicks are NOT in-app', () => {
    expect(isInAppClick(makeEvent({ metaKey: true }))).toBe(false);
    expect(isInAppClick(makeEvent({ ctrlKey: true }))).toBe(false);
    expect(isInAppClick(makeEvent({ shiftKey: true }))).toBe(false);
    expect(isInAppClick(makeEvent({ altKey: true }))).toBe(false);
  });

  it('target=_blank is not in-app', () => {
    expect(isInAppClick(makeEvent({ target: '_blank' }))).toBe(false);
  });

  it('target=_self IS in-app', () => {
    expect(isInAppClick(makeEvent({ target: '_self' }))).toBe(true);
  });

  it('already-defaultPrevented is not in-app', () => {
    expect(isInAppClick(makeEvent({ defaultPrevented: true }))).toBe(false);
  });
});

describe('<DissolvingLink>', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushSpy.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an anchor with the right href', () => {
    const Wrap = wrap();
    const { getByText } = render(
      <Wrap>
        <DissolvingLink href="/elsewhere">go</DissolvingLink>
      </Wrap>,
    );
    const a = getByText('go') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/elsewhere');
  });

  it('left click triggers dissolve then navigates', () => {
    const Wrap = wrap();
    const { getByText } = render(
      <Wrap>
        <DissolvingLink href="/elsewhere">go</DissolvingLink>
      </Wrap>,
    );
    const a = getByText('go');
    act(() => {
      fireEvent.click(a, { button: 0 });
    });
    expect(pushSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(DEFAULT_DISSOLVE_MS + 1);
    });
    expect(pushSpy).toHaveBeenCalledWith('/elsewhere');
  });

  it('Cmd-click bypasses the dissolve (default browser behaviour)', () => {
    const Wrap = wrap();
    const { getByText } = render(
      <Wrap>
        <DissolvingLink href="/elsewhere">go</DissolvingLink>
      </Wrap>,
    );
    const a = getByText('go');
    act(() => {
      fireEvent.click(a, { button: 0, metaKey: true });
    });
    act(() => {
      vi.advanceTimersByTime(DEFAULT_DISSOLVE_MS + 1);
    });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('replace prop uses router.replace', () => {
    const Wrap = wrap();
    const { getByText } = render(
      <Wrap>
        <DissolvingLink href="/elsewhere" replace>
          go
        </DissolvingLink>
      </Wrap>,
    );
    const a = getByText('go');
    act(() => {
      fireEvent.click(a, { button: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(DEFAULT_DISSOLVE_MS + 1);
    });
    expect(replaceSpy).toHaveBeenCalledWith('/elsewhere');
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('user-supplied onClick still fires before dissolve', () => {
    const userClick = vi.fn();
    const Wrap = wrap();
    const { getByText } = render(
      <Wrap>
        <DissolvingLink href="/elsewhere" onClick={userClick}>
          go
        </DissolvingLink>
      </Wrap>,
    );
    act(() => {
      fireEvent.click(getByText('go'), { button: 0 });
    });
    expect(userClick).toHaveBeenCalled();
  });
});
