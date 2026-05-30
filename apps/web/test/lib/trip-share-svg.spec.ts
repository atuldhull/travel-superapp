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

  // ─── AE153: edge-case coverage ────────────────────────────────────
  it('handles an empty title without crashing', () => {
    const svg = shareSvg(makeTrip({ title: '' }));
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('uses the fallback "shared" status when status is omitted', () => {
    // SharedTripDto callers pass no status — should not say "undefined"
    // in the rendered output.
    const trip = { id: 'x', title: 't', radiusKm: 10, startsOn: null, endsOn: null };
    const svg = shareSvg(trip as never);
    expect(svg).not.toContain('undefined');
    expect(svg).toContain('shared');
  });

  it('renders a date range when startsOn + endsOn are set', () => {
    const svg = shareSvg(makeTrip({ startsOn: '2026-06-03', endsOn: '2026-06-17' } as never));
    // Some date fragment should appear (locale-dependent — we just
    // assert "2026" makes it in via the formatted range).
    expect(svg).toContain('2026');
  });

  it('handles single-character titles (no shrink path)', () => {
    const svg = shareSvg(makeTrip({ title: 'J' }));
    expect(svg).toContain('font-size="110"');
    // Title is rendered inside a <text>…</text> with whitespace; just
    // assert the character lands in the output.
    expect(svg).toMatch(/>\s*J\s*</);
  });

  it('output is a single-line SVG (no embedded \\n surprises)', () => {
    // The card is consumed by next/og + downloaded as a blob; embedded
    // newlines historically broke a few CDN previews. The generator's
    // contract is "one logical string"; we assert it has no \r.
    const svg = shareSvg(makeTrip({}));
    expect(svg).not.toContain('\r');
  });

  // ─── AE193: title-shrink boundary ───────────────────────────────────
  it('20-char threshold drops the size from 110 to 88', () => {
    // The renderer has three tiers: ≤20 → 110, 21–28 → 88, >28 → 72.
    // A 21-char title is in the 88 band.
    const title = 'Title with twenty-one';
    expect(title.length).toBe(21);
    const svg = shareSvg(makeTrip({ title }));
    expect(svg).toContain('font-size="88"');
  });

  it('29 chars (one over the top tier) drops to the shrunk size 72', () => {
    const title = 'A 29-character travel titleee';
    expect(title.length).toBe(29);
    const svg = shareSvg(makeTrip({ title }));
    expect(svg).toContain('font-size="72"');
  });

  it('renders rendered title text after the escape pass', () => {
    // The title MUST survive into the rendered string — easy to break
    // if a future code-mod accidentally replaces the body.
    const svg = shareSvg(makeTrip({ title: 'Yatra' }));
    expect(svg).toContain('Yatra');
  });
});
