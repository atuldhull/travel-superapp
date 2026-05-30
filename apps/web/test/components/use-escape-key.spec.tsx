/**
 * Vitest jsdom specs for AE219 useEscapeKey — the shared
 * "Escape dismisses" listener hook.
 */
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useEscapeKey } from '../../src/components/aether/use-escape-key';

function Probe({ enabled, onEscape }: { enabled: boolean; onEscape: () => void }): ReactElement {
  useEscapeKey({ enabled, onEscape });
  return <span data-testid="probe" />;
}

function pressKey(key: string): boolean {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  return window.dispatchEvent(ev);
}

describe('useEscapeKey', () => {
  it('fires onEscape on Escape when enabled', () => {
    const onEscape = vi.fn();
    render(<Probe enabled onEscape={onEscape} />);
    pressKey('Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire for other keys', () => {
    const onEscape = vi.fn();
    render(<Probe enabled onEscape={onEscape} />);
    pressKey('Enter');
    pressKey('a');
    pressKey('ArrowUp');
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does NOT fire when enabled=false', () => {
    const onEscape = vi.fn();
    render(<Probe enabled={false} onEscape={onEscape} />);
    pressKey('Escape');
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('preventDefault on the Escape event', () => {
    render(<Probe enabled onEscape={() => {}} />);
    const ev = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('toggle enabled false → true restarts listening', () => {
    const onEscape = vi.fn();
    const { rerender } = render(<Probe enabled={false} onEscape={onEscape} />);
    pressKey('Escape');
    expect(onEscape).not.toHaveBeenCalled();
    rerender(<Probe enabled onEscape={onEscape} />);
    pressKey('Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('unmount removes the listener', () => {
    const onEscape = vi.fn();
    const { unmount } = render(<Probe enabled onEscape={onEscape} />);
    unmount();
    pressKey('Escape');
    expect(onEscape).not.toHaveBeenCalled();
  });
});
