/** Vitest specs for AE385 Drift Now Card content + component. */
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  nowCardContent,
  nowCardContentNow,
  timeBandFor,
} from '../../src/components/aether/phase1/now-card-content';
import { DriftNowCard } from '../../src/components/aether/phase1/drift-now-card';

describe('timeBandFor', () => {
  it('5..11 → morning', () => {
    expect(timeBandFor(5)).toBe('morning');
    expect(timeBandFor(8)).toBe('morning');
    expect(timeBandFor(11)).toBe('morning');
  });

  it('12..16 → afternoon', () => {
    expect(timeBandFor(12)).toBe('afternoon');
    expect(timeBandFor(14)).toBe('afternoon');
    expect(timeBandFor(16)).toBe('afternoon');
  });

  it('17..20 → evening', () => {
    expect(timeBandFor(17)).toBe('evening');
    expect(timeBandFor(20)).toBe('evening');
  });

  it('21..23, 0..4 → night', () => {
    expect(timeBandFor(21)).toBe('night');
    expect(timeBandFor(23)).toBe('night');
    expect(timeBandFor(0)).toBe('night');
    expect(timeBandFor(4)).toBe('night');
  });

  it('non-finite hours collapse to night (default branch)', () => {
    expect(timeBandFor(NaN)).toBe('night');
    expect(timeBandFor(Infinity)).toBe('night');
    expect(timeBandFor(-Infinity)).toBe('night');
  });

  it('boundary instants snap forward', () => {
    expect(timeBandFor(4.99)).toBe('night');
    expect(timeBandFor(5.0)).toBe('morning');
    expect(timeBandFor(11.99)).toBe('morning');
    expect(timeBandFor(12.0)).toBe('afternoon');
  });
});

describe('nowCardContent', () => {
  function dateAt(hour: number): Date {
    return new Date(2026, 5, 1, hour, 0, 0);
  }

  it('morning content', () => {
    const c = nowCardContent(dateAt(8));
    expect(c.band).toBe('morning');
    expect(c.headline).toBe('Morning');
    expect(c.suggestion).toContain('Sketch');
    expect(c.verb).toBe('Plan');
  });

  it('afternoon content', () => {
    const c = nowCardContent(dateAt(14));
    expect(c.band).toBe('afternoon');
    expect(c.headline).toBe('Afternoon');
    expect(c.verb).toBe('Refine');
  });

  it('evening content', () => {
    const c = nowCardContent(dateAt(19));
    expect(c.band).toBe('evening');
    expect(c.headline).toBe('Evening');
    expect(c.verb).toBe('Reflect');
  });

  it('night content', () => {
    const c = nowCardContent(dateAt(23));
    expect(c.band).toBe('night');
    expect(c.headline).toBe('Night');
    expect(c.verb).toBe('Dream');
  });

  it('accepts a numeric epoch in addition to a Date', () => {
    const ts = dateAt(10).getTime();
    expect(nowCardContent(ts).band).toBe('morning');
  });

  it('always returns all four fields', () => {
    const c = nowCardContent(dateAt(14));
    expect(c.headline.length).toBeGreaterThan(0);
    expect(c.suggestion.length).toBeGreaterThan(0);
    expect(c.verb.length).toBeGreaterThan(0);
    expect(['morning', 'afternoon', 'evening', 'night']).toContain(c.band);
  });
});

describe('nowCardContentNow', () => {
  it('matches nowCardContent(new Date()) at call time (within a 1s window)', () => {
    const a = nowCardContentNow();
    const b = nowCardContent(new Date());
    expect(a.band).toBe(b.band);
  });
});

describe('<DriftNowCard/>', () => {
  function dateAt(hour: number): Date {
    return new Date(2026, 5, 1, hour, 0, 0);
  }

  it('renders the eyebrow + suggestion + verb', () => {
    const { getByText } = render(<DriftNowCard at={dateAt(8)} />);
    expect(getByText('Morning')).toBeTruthy();
    expect(getByText('Sketch the day ahead.')).toBeTruthy();
    expect(getByText('Plan')).toBeTruthy();
  });

  it('updates content when at prop changes', () => {
    const { getByText, rerender } = render(<DriftNowCard at={dateAt(8)} />);
    expect(getByText('Morning')).toBeTruthy();
    rerender(<DriftNowCard at={dateAt(22)} />);
    expect(getByText('Night')).toBeTruthy();
    expect(getByText('Dream')).toBeTruthy();
  });

  it('exposes aria-label for the surface-time band', () => {
    const { container } = render(<DriftNowCard at={dateAt(14)} />);
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('aria-label')).toBe('Now: Afternoon');
  });

  it('verb button carries data-aether-now-verb', () => {
    const { container } = render(<DriftNowCard at={dateAt(19)} />);
    const btn = container.querySelector('[data-aether-now-verb]');
    expect(btn?.getAttribute('data-aether-now-verb')).toBe('Reflect');
  });

  it('hidden prop returns null', () => {
    const { container } = render(<DriftNowCard at={dateAt(8)} hidden />);
    expect(container.querySelector('aside')).toBeNull();
  });
});
