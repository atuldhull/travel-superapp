/** Vitest specs for AE389 <Phase1PulseOverlay>. */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceManagerProvider, createSurfaceRegistry } from '@app/aether-core';
import type { ReactNode } from 'react';
import {
  Phase1PulseOverlay,
  Phase1PulseOverlayStandalone,
} from '../../src/components/aether/phase1/phase1-pulse-overlay';

function wrap(opts?: {
  withPulse?: boolean;
  pathname?: string;
}): React.FC<{ children: ReactNode }> {
  const withPulse = opts?.withPulse ?? true;
  const pathname = opts?.pathname ?? '/aether/drift';
  const registry = createSurfaceRegistry([
    {
      id: 'drift',
      phase: 1,
      route: { kind: 'literal', pathname: '/aether/drift' },
    },
    ...(withPulse
      ? [
          {
            id: 'pulse' as const,
            phase: 1 as const,
            route: { kind: 'overlay' as const },
          },
        ]
      : []),
  ]);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname={pathname}>
        {children}
      </SurfaceManagerProvider>
    );
  };
}

describe('<Phase1PulseOverlay/> — outer overlay container', () => {
  it('renders the fixed corner div when pulse is registered', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1PulseOverlay disableCanvas />
      </Wrap>,
    );
    const el = document.querySelector('[data-aether-pulse-overlay]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-aether-pulse-corner')).toBe('bottom-right');
  });

  it('skips render when pulse is NOT in the registry', () => {
    const Wrap = wrap({ withPulse: false });
    render(
      <Wrap>
        <Phase1PulseOverlay disableCanvas />
      </Wrap>,
    );
    expect(document.querySelector('[data-aether-pulse-overlay]')).toBeNull();
  });

  it('skips render when hidden=true', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1PulseOverlay disableCanvas hidden />
      </Wrap>,
    );
    expect(document.querySelector('[data-aether-pulse-overlay]')).toBeNull();
  });

  it('honours the corner prop', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1PulseOverlay disableCanvas corner="top-left" />
      </Wrap>,
    );
    const el = document.querySelector('[data-aether-pulse-overlay]');
    expect(el?.getAttribute('data-aether-pulse-corner')).toBe('top-left');
  });

  it('applies the default aria-label', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1PulseOverlay disableCanvas />
      </Wrap>,
    );
    expect(screen.getByLabelText('Aether Pulse — always-on AI')).toBeTruthy();
  });

  it('exposes role=button when onActivate is provided, presentation otherwise', () => {
    const Wrap = wrap();
    const { rerender } = render(
      <Wrap>
        <Phase1PulseOverlay disableCanvas />
      </Wrap>,
    );
    expect(document.querySelector('[data-aether-pulse-overlay]')?.getAttribute('role')).toBe(
      'presentation',
    );
    rerender(
      <Wrap>
        <Phase1PulseOverlay disableCanvas onActivate={() => {}} />
      </Wrap>,
    );
    expect(document.querySelector('[data-aether-pulse-overlay]')?.getAttribute('role')).toBe(
      'button',
    );
  });

  it('fires onActivate on click + Enter + Space', () => {
    const Wrap = wrap();
    const fn = vi.fn();
    render(
      <Wrap>
        <Phase1PulseOverlay disableCanvas onActivate={fn} />
      </Wrap>,
    );
    const el = document.querySelector('[data-aether-pulse-overlay]') as HTMLDivElement;
    el.click();
    expect(fn).toHaveBeenCalledTimes(1);
    // Enter
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    el.dispatchEvent(enterEvent);
    expect(fn).toHaveBeenCalledTimes(2);
    // Space
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    el.dispatchEvent(spaceEvent);
    expect(fn).toHaveBeenCalledTimes(3);
    // Tab is NOT an activate key
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    el.dispatchEvent(tabEvent);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('overlay sits fixed-position with 64x64 footprint', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1PulseOverlay disableCanvas />
      </Wrap>,
    );
    const el = document.querySelector('[data-aether-pulse-overlay]') as HTMLDivElement;
    expect(el.style.position).toBe('fixed');
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('64px');
    expect(el.style.borderRadius).toBe('50%');
  });
});

describe('<Phase1PulseOverlayStandalone/> — provider-less variant', () => {
  it('renders without SurfaceManagerProvider when mood is pinned', () => {
    render(<Phase1PulseOverlayStandalone disableCanvas mood="idle" />);
    expect(document.querySelector('[data-aether-pulse-overlay]')).not.toBeNull();
  });

  it('honours corner prop in standalone mode', () => {
    render(<Phase1PulseOverlayStandalone disableCanvas mood="listening" corner="top-right" />);
    const el = document.querySelector('[data-aether-pulse-overlay]');
    expect(el?.getAttribute('data-aether-pulse-corner')).toBe('top-right');
  });
});
