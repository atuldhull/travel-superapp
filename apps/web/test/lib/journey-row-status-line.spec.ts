/**
 * Vitest specs for AE234 buildJourneyRowStatusLine.
 */
import { describe, expect, it } from 'vitest';
import { buildJourneyRowStatusLine } from '../../src/components/aether/me/journey-row-status-line';

describe('buildJourneyRowStatusLine', () => {
  it('minimal: status + 0 shares', () => {
    expect(buildJourneyRowStatusLine({ status: 'draft', days: null, shareCount: 0 })).toBe(
      'Draft · 0 shares',
    );
  });

  it('active + 5 days + 3 shares', () => {
    expect(buildJourneyRowStatusLine({ status: 'active', days: 5, shareCount: 3 })).toBe(
      'Active · 5 days · 3 shares',
    );
  });

  it('1 day singular + 1 share singular', () => {
    expect(buildJourneyRowStatusLine({ status: 'upcoming', days: 1, shareCount: 1 })).toBe(
      'Upcoming · 1 day · 1 share',
    );
  });

  it('0 days NOT rendered (just status + shares)', () => {
    expect(buildJourneyRowStatusLine({ status: 'draft', days: 0, shareCount: 0 })).toBe(
      'Draft · 0 shares',
    );
  });

  it('null days NOT rendered', () => {
    expect(buildJourneyRowStatusLine({ status: 'archived', days: null, shareCount: 2 })).toBe(
      'Archived · 2 shares',
    );
  });

  it('in-season segment appended when inSeasonOf is set', () => {
    expect(
      buildJourneyRowStatusLine({
        status: 'active',
        days: 4,
        shareCount: 0,
        inSeasonOf: 'Leh',
      }),
    ).toBe('Active · 4 days · 0 shares · Leh in season');
  });

  it('inSeasonOf empty string NOT appended', () => {
    expect(
      buildJourneyRowStatusLine({
        status: 'active',
        days: 4,
        shareCount: 0,
        inSeasonOf: '',
      }),
    ).toBe('Active · 4 days · 0 shares');
  });

  it('every status renders with its capitalised label', () => {
    expect(buildJourneyRowStatusLine({ status: 'draft', days: null, shareCount: 0 })).toMatch(
      /^Draft/,
    );
    expect(buildJourneyRowStatusLine({ status: 'upcoming', days: null, shareCount: 0 })).toMatch(
      /^Upcoming/,
    );
    expect(buildJourneyRowStatusLine({ status: 'active', days: null, shareCount: 0 })).toMatch(
      /^Active/,
    );
    expect(buildJourneyRowStatusLine({ status: 'past', days: null, shareCount: 0 })).toMatch(
      /^Past/,
    );
    expect(buildJourneyRowStatusLine({ status: 'archived', days: null, shareCount: 0 })).toMatch(
      /^Archived/,
    );
  });

  it('negative days are skipped (defensive)', () => {
    expect(buildJourneyRowStatusLine({ status: 'draft', days: -1, shareCount: 0 })).toBe(
      'Draft · 0 shares',
    );
  });
});
