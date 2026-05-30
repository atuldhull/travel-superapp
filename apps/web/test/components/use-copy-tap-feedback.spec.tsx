/**
 * Vitest jsdom specs for AE211 useCopyTapFeedback — the shared
 * "✓ copied" tap-feedback hook.
 */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyTapFeedback } from '../../src/components/aether/use-copy-tap-feedback';

interface ProbeRef {
  copied: boolean;
  flash: () => void;
}

function Probe({ windowMs, out }: { windowMs?: number; out: ProbeRef }): JSX.Element {
  const { copied, flash } = useCopyTapFeedback(windowMs);
  // Mirror to the shared ref so the spec can read state without DOM.
  out.copied = copied;
  out.flash = flash;
  return <span data-testid="probe">{copied ? 'on' : 'off'}</span>;
}

describe('useCopyTapFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with copied=false', () => {
    const out: ProbeRef = { copied: true, flash: () => {} };
    render(<Probe out={out} />);
    expect(out.copied).toBe(false);
  });

  it('flash() flips to true; auto-reverts after windowMs', () => {
    const out: ProbeRef = { copied: false, flash: () => {} };
    render(<Probe windowMs={1500} out={out} />);

    act(() => out.flash());
    expect(out.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(out.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(out.copied).toBe(false);
  });

  it('rapid double-flash restarts the timer (no early revert)', () => {
    const out: ProbeRef = { copied: false, flash: () => {} };
    render(<Probe windowMs={1500} out={out} />);

    act(() => out.flash());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => out.flash()); // restart at 1000ms in
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Still on (only 1000ms into the second window).
    expect(out.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(out.copied).toBe(false);
  });

  it('honours a custom windowMs', () => {
    const out: ProbeRef = { copied: false, flash: () => {} };
    render(<Probe windowMs={400} out={out} />);

    act(() => out.flash());
    expect(out.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(out.copied).toBe(false);
  });

  it('unmount clears the pending timer (no setState-after-unmount warning)', () => {
    const out: ProbeRef = { copied: false, flash: () => {} };
    const { unmount } = render(<Probe windowMs={1500} out={out} />);

    act(() => out.flash());
    expect(out.copied).toBe(true);

    // Unmount mid-window; advancing timers should NOT trigger a
    // setState on the unmounted component. The hook's cleanup
    // clears the timer.
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // No throw, no console error: success.
  });
});
