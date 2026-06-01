/** Vitest specs for AE424 Mirror Investigate-user helpers. */
import { describe, expect, it } from 'vitest';
import {
  filterUserSuggestions,
  formatInvestigationCount,
  highlightRange,
  investigationAnnouncement,
  investigationSeverity,
  isInvestigationHotkey,
  type MirrorInvestigation,
  type MirrorUserSuggestion,
} from '../../src/components/aether/phase3/mirror-investigate';

const SAMPLE: ReadonlyArray<MirrorUserSuggestion> = [
  { id: 'u_a7c41e9b', displayName: 'Asha Verma', contextTag: '23 trips · Mumbai' },
  { id: 'u_b1c92d34', displayName: 'Vikrant Khanna', contextTag: '11 trips · Goa' },
  { id: 'u_d6f31a87', displayName: 'Aisha Roy', contextTag: '8 trips · Jaipur' },
];

describe('isInvestigationHotkey (pure)', () => {
  it('Cmd+K on macOS fires', () => {
    expect(isInvestigationHotkey({ key: 'k', metaKey: true, ctrlKey: false })).toBe(true);
  });
  it('Ctrl+K elsewhere fires', () => {
    expect(isInvestigationHotkey({ key: 'k', metaKey: false, ctrlKey: true })).toBe(true);
  });
  it('case-insensitive (K)', () => {
    expect(isInvestigationHotkey({ key: 'K', metaKey: true, ctrlKey: false })).toBe(true);
  });
  it('plain k without modifier ignored', () => {
    expect(isInvestigationHotkey({ key: 'k', metaKey: false, ctrlKey: false })).toBe(false);
  });
  it('other letters with modifier ignored', () => {
    expect(isInvestigationHotkey({ key: 'p', metaKey: true, ctrlKey: false })).toBe(false);
  });
});

describe('filterUserSuggestions (pure)', () => {
  it('empty query returns the whole list', () => {
    expect(filterUserSuggestions(SAMPLE, '').length).toBe(SAMPLE.length);
  });
  it('matches by display name (case-insensitive)', () => {
    // 'Asha Verma' contains 'asha'; 'Aisha Roy' contains 'isha' (not 'asha').
    expect(filterUserSuggestions(SAMPLE, 'asha').map((s) => s.id)).toEqual(['u_a7c41e9b']);
    // 'sha' matches both 'Asha' and 'Aisha'.
    expect(filterUserSuggestions(SAMPLE, 'sha').map((s) => s.id)).toEqual([
      'u_a7c41e9b',
      'u_d6f31a87',
    ]);
  });
  it('matches by id substring', () => {
    expect(filterUserSuggestions(SAMPLE, 'b1c92').map((s) => s.id)).toEqual(['u_b1c92d34']);
  });
  it('matches by context tag', () => {
    expect(filterUserSuggestions(SAMPLE, 'goa').map((s) => s.id)).toEqual(['u_b1c92d34']);
  });
  it('trims whitespace from the query', () => {
    expect(filterUserSuggestions(SAMPLE, '   sha   ').length).toBe(2);
  });
  it('no-match returns empty list', () => {
    expect(filterUserSuggestions(SAMPLE, 'zzzz').length).toBe(0);
  });
});

describe('highlightRange (pure)', () => {
  it('returns null when query empty', () => {
    expect(highlightRange('Asha Verma', '')).toBeNull();
  });
  it('returns null when no match', () => {
    expect(highlightRange('Asha Verma', 'zzz')).toBeNull();
  });
  it('finds prefix match', () => {
    expect(highlightRange('Asha Verma', 'asha')).toEqual({ start: 0, end: 4 });
  });
  it('finds substring match (case-insensitive)', () => {
    expect(highlightRange('Aisha Roy', 'sha')).toEqual({ start: 2, end: 5 });
  });
});

describe('formatInvestigationCount (pure)', () => {
  it('null / undefined → em-dash', () => {
    expect(formatInvestigationCount(null)).toBe('—');
    expect(formatInvestigationCount(undefined)).toBe('—');
  });
  it('zero → em-dash (so empty blocks read as "not loaded")', () => {
    expect(formatInvestigationCount(0)).toBe('—');
  });
  it('positive integers format with thousands separator', () => {
    expect(formatInvestigationCount(7)).toBe('7');
    expect(formatInvestigationCount(1234)).toBe('1,234');
  });
  it('non-finite → em-dash', () => {
    expect(formatInvestigationCount(Number.NaN)).toBe('—');
    expect(formatInvestigationCount(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('investigationSeverity (pure)', () => {
  it('< 2 mentions → low', () => {
    expect(investigationSeverity(0)).toBe('low');
    expect(investigationSeverity(1)).toBe('low');
  });
  it('2-5 mentions → medium', () => {
    expect(investigationSeverity(2)).toBe('medium');
    expect(investigationSeverity(5)).toBe('medium');
  });
  it('6+ mentions → high', () => {
    expect(investigationSeverity(6)).toBe('high');
    expect(investigationSeverity(99)).toBe('high');
  });
  it('NaN → low (safe default)', () => {
    expect(investigationSeverity(Number.NaN)).toBe('low');
  });
});

describe('investigationAnnouncement (pure)', () => {
  const inv: MirrorInvestigation = {
    userId: 'u_a7c41e9b',
    displayName: 'Asha Verma',
    trips: 23,
    reviews: 41,
    payments: 19,
    auditMentions: 1,
    summary: 'Heavy traveller',
    lastAuditedAt: null,
  };
  it('null → "Investigation closed"', () => {
    expect(investigationAnnouncement(null)).toBe('Investigation closed');
  });
  it('non-null → folds the counts in', () => {
    const line = investigationAnnouncement(inv);
    expect(line).toContain('Asha Verma');
    expect(line).toContain('23 trips');
    expect(line).toContain('41 reviews');
    expect(line).toContain('19 payments');
    expect(line).toContain('1 audit mentions');
  });
});

// AE466 — boundary conditions for the Mirror Investigate helpers. The
// severity tiers + count formatter + filter share a single low-level
// shape with the rest of Phase 3, so we pin the exact threshold values
// + the millions-separator path + the separator-character substring
// match + the whitespace-only query degeneracy so future refactors don't
// drift either direction without flipping a spec.
describe('investigationSeverity (AE466 boundary thresholds)', () => {
  it('exactly 2 → medium (lower bound, inclusive)', () => {
    expect(investigationSeverity(2)).toBe('medium');
  });
  it('just below the medium threshold (1.999) → low', () => {
    expect(investigationSeverity(1.999)).toBe('low');
  });
  it('just above the medium threshold (2.001) → medium', () => {
    expect(investigationSeverity(2.001)).toBe('medium');
  });
  it('exactly 6 → high (lower bound, inclusive)', () => {
    expect(investigationSeverity(6)).toBe('high');
  });
  it('just below the high threshold (5.999) → medium', () => {
    expect(investigationSeverity(5.999)).toBe('medium');
  });
  it('just above the high threshold (6.001) → high', () => {
    expect(investigationSeverity(6.001)).toBe('high');
  });
  it('Infinity → low (non-finite collapses to safe default)', () => {
    expect(investigationSeverity(Number.POSITIVE_INFINITY)).toBe('low');
    expect(investigationSeverity(Number.NEGATIVE_INFINITY)).toBe('low');
  });
  it('negative counts → low (clamps below the medium floor)', () => {
    expect(investigationSeverity(-1)).toBe('low');
    expect(investigationSeverity(-9999)).toBe('low');
  });
});

describe('formatInvestigationCount (AE466 millions-scale + locale)', () => {
  // Locale-agnostic checks: the helper delegates to toLocaleString() with
  // no explicit locale, so the exact grouping depends on the test host's
  // default locale (en-US groups by 3, en-IN groups by 2 after the first
  // 3). The contract we lock here is: large positive values render as a
  // non-empty digit-with-separators string (not the em-dash), and the
  // digit count is preserved.
  it('large counts render as a non-empty digits+separators string', () => {
    const out = formatInvestigationCount(1_000_000);
    expect(out).not.toBe('—');
    expect(out).toMatch(/^[\d.,]+$/);
    expect(out.replace(/[^0-9]/g, '')).toBe('1000000');
  });
  it('tens-of-millions preserve the digit sequence', () => {
    const out = formatInvestigationCount(12_345_678);
    expect(out.replace(/[^0-9]/g, '')).toBe('12345678');
  });
  it('counts just below 1M preserve the digit sequence', () => {
    const out = formatInvestigationCount(999_999);
    expect(out.replace(/[^0-9]/g, '')).toBe('999999');
  });
  it('very large values use grouping separators (never an em-dash)', () => {
    const out = formatInvestigationCount(1_234_567_890);
    expect(out).not.toBe('—');
    expect(out).toMatch(/^[\d.,]+$/);
    // At least one separator must be present for a 10-digit value.
    expect(out.length).toBeGreaterThan(10);
  });
  it('negative counts collapse to em-dash (treated as "not loaded")', () => {
    expect(formatInvestigationCount(-1)).toBe('—');
    expect(formatInvestigationCount(-1_000_000)).toBe('—');
  });
});

describe('filterUserSuggestions (AE466 separator + whitespace edges)', () => {
  it('matches the middle-dot separator in contextTag (returns every row that uses "·")', () => {
    // All three SAMPLE rows use "·" as the trips/region separator.
    const ids = filterUserSuggestions(SAMPLE, '·').map((s) => s.id);
    expect(ids).toEqual(['u_a7c41e9b', 'u_b1c92d34', 'u_d6f31a87']);
  });
  it('separator query is not stripped — substring-matches " · G" (one row)', () => {
    const ids = filterUserSuggestions(SAMPLE, ' · G').map((s) => s.id);
    expect(ids).toEqual(['u_b1c92d34']);
  });
  it('whitespace-only query returns the whole list (trim collapses to empty)', () => {
    expect(filterUserSuggestions(SAMPLE, '   ').length).toBe(SAMPLE.length);
    expect(filterUserSuggestions(SAMPLE, '\t\n').length).toBe(SAMPLE.length);
  });
  it('whitespace-only query never throws', () => {
    expect(() => filterUserSuggestions(SAMPLE, '   ')).not.toThrow();
    expect(() => filterUserSuggestions(SAMPLE, '\t\n\r   ')).not.toThrow();
  });
  it('separator-only context-tag query against an empty list is a no-op (returns [])', () => {
    expect(filterUserSuggestions([], '·').length).toBe(0);
  });
});

describe('highlightRange (AE466 whitespace-only + separator edges)', () => {
  it('whitespace-only query → null (no highlight)', () => {
    expect(highlightRange('Asha Verma', '   ')).toBeNull();
  });
  it('separator character query matches when present in name', () => {
    expect(highlightRange('Asha · Verma', '·')).toEqual({ start: 5, end: 6 });
  });
});
