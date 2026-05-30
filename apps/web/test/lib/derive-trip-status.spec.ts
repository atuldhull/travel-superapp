/**
 * Vitest specs for AE217 deriveTripStatus — trip lifecycle status
 * (draft/upcoming/active/past/archived) from date fields.
 */
import { describe, expect, it } from 'vitest';
import { deriveTripStatus } from '../../src/components/aether/journey/derive-trip-status';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('deriveTripStatus', () => {
  it('archived beats everything else when archivedAt is set', () => {
    expect(
      deriveTripStatus(
        {
          startsOn: '2026-06-01T00:00:00Z',
          endsOn: '2026-06-05T00:00:00Z',
          archivedAt: '2026-06-10T00:00:00Z',
        },
        NOW,
      ),
    ).toBe('archived');
  });

  it('archived even when no dates are set', () => {
    expect(
      deriveTripStatus({ startsOn: null, endsOn: null, archivedAt: '2026-06-10T00:00:00Z' }, NOW),
    ).toBe('archived');
  });

  it("both dates missing + not archived → 'draft'", () => {
    expect(deriveTripStatus({ startsOn: null, endsOn: null, archivedAt: null }, NOW)).toBe('draft');
  });

  it("now < startsOn → 'upcoming'", () => {
    expect(
      deriveTripStatus(
        { startsOn: '2026-07-01T00:00:00Z', endsOn: '2026-07-05T00:00:00Z', archivedAt: null },
        NOW,
      ),
    ).toBe('upcoming');
  });

  it("endsOn < now → 'past'", () => {
    expect(
      deriveTripStatus(
        { startsOn: '2026-05-01T00:00:00Z', endsOn: '2026-05-10T00:00:00Z', archivedAt: null },
        NOW,
      ),
    ).toBe('past');
  });

  it("now within [startsOn, endsOn] → 'active'", () => {
    expect(
      deriveTripStatus(
        { startsOn: '2026-06-10T00:00:00Z', endsOn: '2026-06-20T00:00:00Z', archivedAt: null },
        NOW,
      ),
    ).toBe('active');
  });

  it("startsOn only, in the future → 'upcoming'", () => {
    expect(
      deriveTripStatus({ startsOn: '2026-07-01T00:00:00Z', endsOn: null, archivedAt: null }, NOW),
    ).toBe('upcoming');
  });

  it("startsOn only, in the past, no endsOn → 'active' (open-ended ongoing)", () => {
    expect(
      deriveTripStatus({ startsOn: '2026-05-01T00:00:00Z', endsOn: null, archivedAt: null }, NOW),
    ).toBe('active');
  });

  it("endsOn only, in the future → 'active' (started already)", () => {
    expect(
      deriveTripStatus({ startsOn: null, endsOn: '2026-07-01T00:00:00Z', archivedAt: null }, NOW),
    ).toBe('active');
  });

  it('empty-string archivedAt is NOT treated as archived', () => {
    expect(
      deriveTripStatus(
        { startsOn: '2026-06-10T00:00:00Z', endsOn: '2026-06-20T00:00:00Z', archivedAt: '' },
        NOW,
      ),
    ).toBe('active');
  });

  it('unparseable ISO degenerates to null (tolerated, classifies via remaining fields)', () => {
    expect(
      deriveTripStatus({ startsOn: 'bogus', endsOn: 'also-bogus', archivedAt: null }, NOW),
    ).toBe('draft');
  });

  it('snapping boundary: now === startsOn → active (not upcoming)', () => {
    expect(
      deriveTripStatus(
        { startsOn: NOW.toISOString(), endsOn: '2026-06-20T00:00:00Z', archivedAt: null },
        NOW,
      ),
    ).toBe('active');
  });
});
