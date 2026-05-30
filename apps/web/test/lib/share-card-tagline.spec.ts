/**
 * Vitest specs for AE272 buildShareCardTagline.
 */
import { describe, expect, it } from 'vitest';
import { buildShareCardTagline } from '../../src/components/aether/journey/share-card-tagline';

describe('buildShareCardTagline', () => {
  it('both dates + radius', () => {
    expect(
      buildShareCardTagline({
        startsOn: '2026-06-01',
        endsOn: '2026-06-05',
        radiusKm: 50,
      }),
    ).toBe('5 days · ~50km radius');
  });

  it('only dates', () => {
    expect(
      buildShareCardTagline({
        startsOn: '2026-06-01',
        endsOn: '2026-06-05',
        radiusKm: null,
      }),
    ).toBe('5 days');
  });

  it('only radius', () => {
    expect(
      buildShareCardTagline({
        startsOn: null,
        endsOn: null,
        radiusKm: 50,
      }),
    ).toBe('~50km radius');
  });

  it('neither → ""', () => {
    expect(buildShareCardTagline({ startsOn: null, endsOn: null, radiusKm: null })).toBe('');
  });

  it('1 day singular', () => {
    expect(
      buildShareCardTagline({
        startsOn: '2026-06-01',
        endsOn: '2026-06-01',
        radiusKm: 1,
      }),
    ).toBe('1 day · ~1km radius');
  });

  it('zero radius is dropped', () => {
    expect(
      buildShareCardTagline({
        startsOn: '2026-06-01',
        endsOn: '2026-06-02',
        radiusKm: 0,
      }),
    ).toBe('2 days');
  });

  it('negative radius is dropped', () => {
    expect(
      buildShareCardTagline({
        startsOn: '2026-06-01',
        endsOn: '2026-06-02',
        radiusKm: -1,
      }),
    ).toBe('2 days');
  });
});
