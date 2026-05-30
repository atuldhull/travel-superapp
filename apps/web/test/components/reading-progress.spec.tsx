/**
 * Vitest jsdom spec for <ReadingProgress/> (AE89).
 *
 * The component reads `useTheme` + `useMotionPolicy` from
 * `@app/aether-core`, so the test wraps it in `<AetherProvider/>`
 * with the base theme. We assert:
 *   - role="progressbar" is exposed with aria-valuenow / min / max.
 *   - Initial pct is 0 (no scroll in jsdom).
 *   - Resizing dispatches the resize handler without throwing.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AetherProvider } from '@app/aether-core';
import { theme } from '@app/aether-motion';
import { ReadingProgress } from '../../src/components/aether/reading-progress';

function renderProgress(): void {
  render(
    <AetherProvider premiumTier={null} audioOptOut={false} theme={theme}>
      <ReadingProgress />
    </AetherProvider>,
  );
}

describe('<ReadingProgress/>', () => {
  it('exposes progressbar role with aria-valuemin/max/now', () => {
    renderProgress();
    const bar = screen.getByRole('progressbar', { name: 'Reading progress' });
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('pins to the top of the viewport (position: fixed, top: 0)', () => {
    renderProgress();
    const bar = screen.getByRole('progressbar');
    // Inline styles surface via style attribute (jsdom does not
    // compute layout but does expose the inline style.)
    expect(bar.style.position).toBe('fixed');
    expect(bar.style.top).toBe('0px');
    expect(bar.style.height).toBe('2px');
  });

  it('inner bar starts at width: 0% when nothing has scrolled', () => {
    renderProgress();
    const bar = screen.getByRole('progressbar');
    const inner = bar.firstElementChild as HTMLElement | null;
    expect(inner).not.toBeNull();
    expect(inner?.style.width).toBe('0%');
  });

  it('survives a window resize event without throwing', () => {
    renderProgress();
    // Just ensure no exception when the registered listener fires.
    window.dispatchEvent(new Event('resize'));
    const bar = screen.getByRole('progressbar');
    expect(bar).toBeInTheDocument();
  });
});
