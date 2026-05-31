/** Vitest specs for AE391 <Phase1ContinuumReceiverToast>. */
// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase1ContinuumReceiverToast } from '../../src/components/aether/phase1/phase1-continuum-receiver-toast';
import {
  NO_CONTINUUM_LANDING,
  type ContinuumLanding,
} from '../../src/components/aether/phase1/continuum-landing';

const HANDOFF: ContinuumLanding = { isHandoff: true, extras: { trip: 'abc-123' } };
const HANDOFF_BARE: ContinuumLanding = { isHandoff: true, extras: {} };
const HANDOFF_UNKNOWN: ContinuumLanding = {
  isHandoff: true,
  extras: { mystery: 'x' },
};

describe('<Phase1ContinuumReceiverToast/> — render gating', () => {
  it('renders when landing.isHandoff is true', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF_BARE} />);
    expect(document.querySelector('[data-aether-continuum-receiver-toast]')).not.toBeNull();
  });

  it('skips render when not a handoff', () => {
    render(<Phase1ContinuumReceiverToast landing={NO_CONTINUUM_LANDING} />);
    expect(document.querySelector('[data-aether-continuum-receiver-toast]')).toBeNull();
  });

  it('skips when hidden=true', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} hidden />);
    expect(document.querySelector('[data-aether-continuum-receiver-toast]')).toBeNull();
  });

  it('skips when initialDismissed=true', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} initialDismissed />);
    expect(document.querySelector('[data-aether-continuum-receiver-toast]')).toBeNull();
  });

  it('exposes role=status + aria-live=polite for screen readers', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} />);
    const el = document.querySelector('[data-aether-continuum-receiver-toast]');
    expect(el?.getAttribute('role')).toBe('status');
    expect(el?.getAttribute('aria-live')).toBe('polite');
  });
});

describe('<Phase1ContinuumReceiverToast/> — message content', () => {
  it('shows the bare message with no extras', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF_BARE} />);
    const text = document.querySelector('[data-aether-continuum-receiver-toast]')?.textContent;
    expect(text).toContain('Continued from another device');
  });

  it('shows trip-restored hint when trip extra present', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} />);
    const text = document.querySelector('[data-aether-continuum-receiver-toast]')?.textContent;
    expect(text).toContain('trip restored');
  });

  it('summarises unknown extras as N hints', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF_UNKNOWN} />);
    const text = document.querySelector('[data-aether-continuum-receiver-toast]')?.textContent;
    expect(text).toContain('with 1 hint');
  });
});

describe('<Phase1ContinuumReceiverToast/> — dismissal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-dismisses after autoDismissMs', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} autoDismissMs={1000} />);
    expect(document.querySelector('[data-aether-continuum-receiver-toast]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(document.querySelector('[data-aether-continuum-receiver-toast]')).toBeNull();
  });

  it('does NOT auto-dismiss when autoDismissMs <= 0', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} autoDismissMs={0} />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(document.querySelector('[data-aether-continuum-receiver-toast]')).not.toBeNull();
  });

  it('dismiss button closes immediately', () => {
    render(<Phase1ContinuumReceiverToast landing={HANDOFF} autoDismissMs={10_000} />);
    const btn = document.querySelector(
      '[data-aether-continuum-receiver-dismiss]',
    ) as HTMLButtonElement;
    fireEvent.click(btn);
    expect(document.querySelector('[data-aether-continuum-receiver-toast]')).toBeNull();
  });

  it('clears its timer on unmount (no late state update)', () => {
    const { unmount } = render(
      <Phase1ContinuumReceiverToast landing={HANDOFF} autoDismissMs={1000} />,
    );
    unmount();
    // Advance past dismiss window — should not throw / leak.
    expect(() => {
      vi.advanceTimersByTime(2000);
    }).not.toThrow();
  });
});
