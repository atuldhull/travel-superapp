/** Vitest specs for AE392 — Pulse overlay → openPulse bridge wiring. */
// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceManagerProvider, createSurfaceRegistry } from '@app/aether-core';
import type { ReactNode } from 'react';
import { Phase1PulseOverlay } from '../../src/components/aether/phase1/phase1-pulse-overlay';
import { openPulse } from '../../src/components/aether/pulse/open-pulse';

function wrap(): React.FC<{ children: ReactNode }> {
  const registry = createSurfaceRegistry([
    { id: 'drift', phase: 1, route: { kind: 'literal', pathname: '/aether/drift' } },
    { id: 'pulse', phase: 1, route: { kind: 'overlay' } },
  ]);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname="/aether/drift">
        {children}
      </SurfaceManagerProvider>
    );
  };
}

describe('AE392 — Pulse overlay onActivate dispatches aether-pulse-open', () => {
  it('click on the Pulse overlay fires a bridged CustomEvent', () => {
    const Wrap = wrap();
    const listener = vi.fn();
    window.addEventListener('aether-pulse-open', listener);
    try {
      render(
        <Wrap>
          <Phase1PulseOverlay disableCanvas onActivate={() => openPulse('Plan a slow Leh trip')} />
        </Wrap>,
      );
      const el = document.querySelector('[data-aether-pulse-overlay]') as HTMLDivElement;
      fireEvent.click(el);
      expect(listener).toHaveBeenCalledTimes(1);
      const detail = (listener.mock.calls[0]?.[0] as CustomEvent).detail as {
        prefill: string;
        submit?: boolean;
      };
      expect(detail.prefill).toBe('Plan a slow Leh trip');
      expect(detail.submit).toBeUndefined();
    } finally {
      window.removeEventListener('aether-pulse-open', listener);
    }
  });

  it('empty prefill still dispatches (just opens the drawer)', () => {
    const Wrap = wrap();
    const listener = vi.fn();
    window.addEventListener('aether-pulse-open', listener);
    try {
      render(
        <Wrap>
          <Phase1PulseOverlay disableCanvas onActivate={() => openPulse('')} />
        </Wrap>,
      );
      const el = document.querySelector('[data-aether-pulse-overlay]') as HTMLDivElement;
      fireEvent.click(el);
      expect(listener).toHaveBeenCalledTimes(1);
      const detail = (listener.mock.calls[0]?.[0] as CustomEvent).detail as {
        prefill: string;
      };
      expect(detail.prefill).toBe('');
    } finally {
      window.removeEventListener('aether-pulse-open', listener);
    }
  });

  it('Enter on the Pulse overlay also dispatches', () => {
    const Wrap = wrap();
    const listener = vi.fn();
    window.addEventListener('aether-pulse-open', listener);
    try {
      render(
        <Wrap>
          <Phase1PulseOverlay disableCanvas onActivate={() => openPulse('hello')} />
        </Wrap>,
      );
      const el = document.querySelector('[data-aether-pulse-overlay]') as HTMLDivElement;
      fireEvent.keyDown(el, { key: 'Enter' });
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('aether-pulse-open', listener);
    }
  });

  it('without onActivate the overlay is role=presentation (no dispatch path)', () => {
    const Wrap = wrap();
    const listener = vi.fn();
    window.addEventListener('aether-pulse-open', listener);
    try {
      render(
        <Wrap>
          <Phase1PulseOverlay disableCanvas />
        </Wrap>,
      );
      const el = document.querySelector('[data-aether-pulse-overlay]') as HTMLDivElement;
      expect(el.getAttribute('role')).toBe('presentation');
      fireEvent.click(el);
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('aether-pulse-open', listener);
    }
  });
});
