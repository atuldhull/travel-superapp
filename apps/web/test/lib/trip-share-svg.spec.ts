/**
 * Unit tests for the AE79 share-card SVG generator. Asserts that:
 *   - The returned string is well-formed-ish (root <svg>, viewBox).
 *   - The trip title is XML-escaped (no literal `<` slipping through).
 *   - The radius + status fields land in the rendered string.
 *   - A long title triggers the shrink-to-72 path.
 */
import { describe, expect, it } from 'vitest';
import { shareSvg } from '../../src/components/aether/journey/trip-share-card';
import type { TripDto } from '@app/sdk';

function makeTrip(overrides: Partial<TripDto>): TripDto {
  // We cast through unknown because TripDto's nullable fields are
  // wrapped types; the runtime only needs strings | null.
  return {
    id: '0123abcd-aaaa-bbbb-cccc-deadbeef',
    userId: 'usr_1',
    title: 'A Test Yatra',
    status: 'draft',
    radiusKm: 50,
    startsOn: null,
    endsOn: null,
    version: 1,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as unknown as TripDto;
}

describe('shareSvg', () => {
  it('returns SVG markup with the canonical viewBox', () => {
    const svg = shareSvg(makeTrip({}));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain('</svg>');
  });

  it('XML-escapes the trip title so injection is impossible', () => {
    const svg = shareSvg(makeTrip({ title: 'A <bad> & "title"' }));
    expect(svg).not.toMatch(/<bad>/);
    expect(svg).toContain('A &lt;bad&gt; &amp; &quot;title&quot;');
  });

  it('renders the radius + status fields verbatim', () => {
    const svg = shareSvg(makeTrip({ radiusKm: 137, status: 'in-flight' }));
    expect(svg).toContain('>137 km<');
    expect(svg).toContain('>in-flight<');
  });

  it('shrinks the title font size for long titles (>28 chars)', () => {
    const longTitle = 'A really long journey across thirty cities and back again';
    const svg = shareSvg(makeTrip({ title: longTitle }));
    expect(svg).toContain('font-size="72"');
  });

  it('uses font-size 110 for short titles', () => {
    const svg = shareSvg(makeTrip({ title: 'Jaipur' }));
    expect(svg).toContain('font-size="110"');
  });

  it('shows the trip id prefix in the footer', () => {
    const svg = shareSvg(makeTrip({ id: 'beefcafe-1234-5678-9abc-def012345678' }));
    expect(svg).toContain('beefcafe');
  });
});
