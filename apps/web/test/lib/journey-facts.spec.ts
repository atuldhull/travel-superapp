/**
 * Vitest specs for AE214 buildJourneyFacts — the journey-dashboard
 * facts-strip builder.
 */
import { describe, expect, it } from 'vitest';
import { buildJourneyFacts } from '../../src/components/aether/journey/journey-facts';

describe('buildJourneyFacts', () => {
  it('always returns 4 cells in canonical order', () => {
    const got = buildJourneyFacts({
      startsOn: null,
      endsOn: null,
      radiusKm: 50,
      createdAt: null,
    });
    expect(got.map((f) => f.label)).toEqual(['Range', 'Days', 'Radius', 'Drafted']);
  });

  it('Range shows "—" when either date is missing', () => {
    const a = buildJourneyFacts({
      startsOn: null,
      endsOn: '2026-06-05T00:00:00Z',
      radiusKm: 10,
      createdAt: null,
    });
    expect(a[0]?.value).toBe('—');

    const b = buildJourneyFacts({
      startsOn: '2026-06-01T00:00:00Z',
      endsOn: null,
      radiusKm: 10,
      createdAt: null,
    });
    expect(b[0]?.value).toBe('—');
  });

  it('Range renders "start – end" when both dates present', () => {
    const got = buildJourneyFacts({
      startsOn: '2026-06-01T00:00:00Z',
      endsOn: '2026-06-05T00:00:00Z',
      radiusKm: 10,
      createdAt: null,
    });
    // We don't lock the locale string — only that it's a non-dash, contains an
    // en-dash separator + the years 2026.
    expect(got[0]?.value).not.toBe('—');
    expect(got[0]?.value).toContain('–');
    expect(got[0]?.value).toMatch(/2026/);
  });

  it('Days uses inclusive day count (Jun 1 → Jun 5 = 5 days)', () => {
    const got = buildJourneyFacts({
      startsOn: '2026-06-01T00:00:00Z',
      endsOn: '2026-06-05T00:00:00Z',
      radiusKm: 10,
      createdAt: null,
    });
    expect(got[1]?.value).toBe('5');
  });

  it('Days shows "—" when dates incomplete', () => {
    const got = buildJourneyFacts({
      startsOn: '2026-06-01T00:00:00Z',
      endsOn: null,
      radiusKm: 10,
      createdAt: null,
    });
    expect(got[1]?.value).toBe('—');
  });

  it('Radius renders as "<n>km"', () => {
    const got = buildJourneyFacts({
      startsOn: null,
      endsOn: null,
      radiusKm: 42,
      createdAt: null,
    });
    expect(got[2]?.value).toBe('42km');
  });

  it('Drafted shows "—" for missing createdAt', () => {
    const got = buildJourneyFacts({
      startsOn: null,
      endsOn: null,
      radiusKm: 1,
      createdAt: null,
    });
    expect(got[3]?.value).toBe('—');
  });

  it('Drafted renders a non-dash for valid createdAt', () => {
    const got = buildJourneyFacts({
      startsOn: null,
      endsOn: null,
      radiusKm: 1,
      createdAt: '2026-05-30T00:00:00Z',
    });
    expect(got[3]?.value).not.toBe('—');
    expect(got[3]?.value).toMatch(/2026/);
  });

  it('single-day trip (start === end) → 1 day inclusive', () => {
    const got = buildJourneyFacts({
      startsOn: '2026-06-01T12:00:00Z',
      endsOn: '2026-06-01T12:00:00Z',
      radiusKm: 1,
      createdAt: null,
    });
    expect(got[1]?.value).toBe('1');
  });
});
