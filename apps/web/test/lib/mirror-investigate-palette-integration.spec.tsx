/** Vitest specs for AE424 `<MirrorInvestigatePalette/>` — jsdom integration. */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { MirrorInvestigatePalette } from '../../src/components/aether/phase3/mirror-investigate-palette';

describe('<MirrorInvestigatePalette/> integration', () => {
  it('does not render the palette until Cmd+K fires', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    expect(container.querySelector('[data-aether-mirror-investigate]')).toBeNull();
  });

  it('Cmd+K opens the palette in search mode', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const el = container.querySelector('[data-aether-mirror-investigate]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-aether-mirror-investigate-mode')).toBe('search');
  });

  it('Ctrl+K opens the palette (non-mac path)', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(container.querySelector('[data-aether-mirror-investigate]')).not.toBeNull();
  });

  it('Esc closes the palette', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(container.querySelector('[data-aether-mirror-investigate]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-aether-mirror-investigate]')).toBeNull();
  });

  it('typing into the input filters the suggestions', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = container.querySelector(
      '[data-aether-mirror-investigate-input]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'asha' } });
    const rows = container.querySelectorAll('[data-aether-mirror-investigate-row]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Asha Verma');
  });

  it('clicking a suggestion flips the palette into dashboard mode', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const firstRow = container.querySelector('[data-aether-mirror-investigate-row]') as HTMLElement;
    fireEvent.click(firstRow);
    const el = container.querySelector('[data-aether-mirror-investigate]');
    expect(el?.getAttribute('data-aether-mirror-investigate-mode')).toBe('dashboard');
    expect(container.querySelector('[data-aether-mirror-investigate-name]')?.textContent).toBe(
      'Asha Verma',
    );
  });

  it('high-severity users get a high tag on the dashboard', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = container.querySelector(
      '[data-aether-mirror-investigate-input]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ravi' } });
    const ravi = container.querySelector('[data-aether-mirror-investigate-row]') as HTMLElement;
    fireEvent.click(ravi);
    expect(
      container.querySelector('[data-aether-mirror-investigate-severity="high"]'),
    ).not.toBeNull();
  });

  it('no-match query renders the empty-state copy', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = container.querySelector(
      '[data-aether-mirror-investigate-input]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'zzz' } });
    const rows = container.querySelectorAll('[data-aether-mirror-investigate-row]');
    expect(rows.length).toBe(0);
    expect(container.querySelector('[data-aether-mirror-investigate-list]')?.textContent).toContain(
      'No users match',
    );
  });

  it('aria-live announcer reflects the active investigation', () => {
    const { container } = render(<MirrorInvestigatePalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    // Before selecting anything, the announcer says "Investigation closed".
    const aria = container.querySelector('[data-aether-mirror-investigate-aria]');
    expect(aria?.textContent).toContain('Investigation closed');
    const firstRow = container.querySelector('[data-aether-mirror-investigate-row]') as HTMLElement;
    fireEvent.click(firstRow);
    expect(aria?.textContent?.toLowerCase()).toContain('investigation');
  });
});
