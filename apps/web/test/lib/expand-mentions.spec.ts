/**
 * Vitest specs for AE371 expandMentions.
 */
import { describe, expect, it } from 'vitest';
import { expandMentions } from '../../src/components/aether/pulse/expand-mentions';

const lookup = {
  leh: { name: 'Leh', state: 'Ladakh' },
  alleppey: { name: 'Alleppey', state: 'Kerala' },
  bhuj: { name: 'Bhuj', state: 'Gujarat' },
};

describe('expandMentions', () => {
  it('empty text → "" unchanged', () => {
    expect(expandMentions('', lookup)).toBe('');
  });

  it('no @ → text unchanged', () => {
    expect(expandMentions('plan a trip', lookup)).toBe('plan a trip');
  });

  it('expands a leading @slug', () => {
    expect(expandMentions('@leh for five days', lookup)).toBe('Leh (Ladakh) for five days');
  });

  it('expands a mid-text @slug', () => {
    expect(expandMentions('Plan @leh + @alleppey for me', lookup)).toBe(
      'Plan Leh (Ladakh) + Alleppey (Kerala) for me',
    );
  });

  it('case-insensitive on slug; output uses lookup case', () => {
    expect(expandMentions('@LEH', lookup)).toBe('Leh (Ladakh)');
    expect(expandMentions('@Leh', lookup)).toBe('Leh (Ladakh)');
  });

  it('unknown slug → left intact', () => {
    expect(expandMentions('Plan @xyz for me', lookup)).toBe('Plan @xyz for me');
  });

  it('email-style me@example.com → unchanged', () => {
    expect(expandMentions('me@example.com', lookup)).toBe('me@example.com');
  });

  it('mixed known + unknown', () => {
    expect(expandMentions('@leh and @xyz', lookup)).toBe('Leh (Ladakh) and @xyz');
  });

  it('preserves punctuation between mention and surrounding text', () => {
    expect(expandMentions('(@leh, @alleppey)', lookup)).toBe('(Leh (Ladakh), Alleppey (Kerala))');
  });

  it('newline before @ counts as a separator', () => {
    expect(expandMentions('hello\n@leh', lookup)).toBe('hello\nLeh (Ladakh)');
  });

  it('empty lookup → all slugs left intact', () => {
    expect(expandMentions('@leh and @alleppey', {})).toBe('@leh and @alleppey');
  });

  it('non-string input passes through verbatim', () => {
    // @ts-expect-error testing defensive non-string path
    expect(expandMentions(null, lookup)).toBeNull();
    // @ts-expect-error
    expect(expandMentions(undefined, lookup)).toBeUndefined();
  });

  it('preserves text positionally (round-trip is one-way only)', () => {
    const out = expandMentions('@leh', lookup);
    expect(out).toBe('Leh (Ladakh)');
  });

  it('multiple sequential mentions are all expanded', () => {
    expect(expandMentions('@leh @alleppey @bhuj', lookup)).toBe(
      'Leh (Ladakh) Alleppey (Kerala) Bhuj (Gujarat)',
    );
  });

  it('slug w/ dash + digit is honoured', () => {
    const ext = { ...lookup, 'south-goa-2': { name: 'South Goa', state: 'Goa' } };
    expect(expandMentions('Plan @south-goa-2 trip', ext)).toBe('Plan South Goa (Goa) trip');
  });
});
