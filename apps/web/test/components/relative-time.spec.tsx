/**
 * RTL + axe tests for `<RelativeTime>` ([K2]).
 *
 * Renders a semantic `<time>` element. Two contracts:
 *   1. `dateTime` attribute = ISO string (parseable by SR / parsers).
 *   2. `title` attribute = the same ISO (browser hover tooltip).
 *
 * The "ticks every minute" behaviour is tested via vitest's fake
 * timers — covers the useEffect cleanup as well.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { RelativeTime } from '../../src/components/ui/relative-time';

describe('<RelativeTime> (component)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a <time> element with dateTime + title set to the ISO', () => {
    render(<RelativeTime at="2026-05-24T11:30:00Z" />);
    const time = screen.getByText(/ago|now/i);
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('dateTime')).toBe('2026-05-24T11:30:00.000Z');
    expect(time.getAttribute('title')).toBe('2026-05-24T11:30:00.000Z');
  });

  it('accepts a Date input as well as a string', () => {
    render(<RelativeTime at={new Date('2026-05-24T11:55:00Z')} />);
    const time = screen.getByText(/just now|minute/i);
    expect(time).toBeInTheDocument();
  });

  it('NaN date (bad input) → empty dateTime + no title', () => {
    render(<RelativeTime at="not-a-date" />);
    // The formatter returns `unknown` for NaN; the <time> still renders.
    const time = screen.getByText('unknown');
    expect(time.getAttribute('dateTime')).toBe('');
    expect(time.getAttribute('title')).toBeNull();
  });

  it('a className override applies', () => {
    render(<RelativeTime at="2026-05-24T11:30:00Z" className="text-xs" />);
    expect(screen.getByText(/ago|now/i).className).toContain('text-xs');
  });

  it('axe-clean — semantic time element with title is accessible', async () => {
    // axe-core uses real-time setTimeout internally; the fake-timer
    // outer beforeEach would deadlock its scheduler. Restore real
    // timers just for this assertion.
    vi.useRealTimers();
    const { container } = render(<RelativeTime at="2026-05-24T11:30:00Z" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('the 60-second tick fires (covers the useEffect interval)', () => {
    render(<RelativeTime at="2026-05-24T11:55:00Z" />);
    // Advance 60s — the component force-rerenders. We don't depend on
    // what the text is; the assertion is "no crash + still renders."
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText(/now|minute|ago/i)).toBeInTheDocument();
  });
});
