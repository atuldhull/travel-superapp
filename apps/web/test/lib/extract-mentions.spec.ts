/**
 * Vitest specs for AE304 extractMentions.
 */
import { describe, expect, it } from 'vitest';
import { extractMentions } from '../../src/components/aether/pulse/extract-mentions';

describe('extractMentions', () => {
  it('empty → []', () => {
    expect(extractMentions('')).toEqual([]);
  });

  it('no mentions → []', () => {
    expect(extractMentions('plan a trip')).toEqual([]);
  });

  it('single mention', () => {
    expect(extractMentions('plan @leh trip')).toEqual(['leh']);
  });

  it('multiple mentions preserve order', () => {
    expect(extractMentions('@leh + @alleppey for me')).toEqual(['leh', 'alleppey']);
  });

  it('lowercases the slug', () => {
    expect(extractMentions('@LEH')).toEqual(['leh']);
  });

  it('de-dupes (first occurrence wins on order)', () => {
    expect(extractMentions('@leh and @leh again @alleppey')).toEqual(['leh', 'alleppey']);
  });

  it('allows digits, dashes, underscores', () => {
    expect(extractMentions('@trip_007 @leh-2026 @abc123')).toEqual([
      'trip_007',
      'leh-2026',
      'abc123',
    ]);
  });

  it('stops at non-slug chars', () => {
    expect(extractMentions('@leh, @jaipur!')).toEqual(['leh', 'jaipur']);
  });

  it('bare @ with no body is ignored', () => {
    expect(extractMentions('hello @ world')).toEqual([]);
  });

  it('email-like patterns: catches the domain stem (documented quirk)', () => {
    // The regex matches '@' + slug chars but doesn't anchor on a
    // word boundary, so 'me@example.com' yields 'example' (stops
    // at the '.'). Callers needing strict 'word-boundary' mentions
    // pre-filter or use a stricter regex.
    expect(extractMentions('contact me@example.com please')).toEqual(['example']);
  });
});
