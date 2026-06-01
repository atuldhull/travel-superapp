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
