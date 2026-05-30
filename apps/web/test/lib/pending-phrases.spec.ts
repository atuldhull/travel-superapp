/**
 * Vitest specs for the AE192 Pulse pending phrase helpers (AE159).
 */
import { describe, expect, it } from 'vitest';
import {
  PENDING_PHRASES,
  nextPendingIdx,
  phraseAt,
} from '../../src/components/aether/pulse/pending-phrases';

describe('PENDING_PHRASES catalogue', () => {
  it('has exactly 3 phrases in editorial cadence', () => {
    expect(PENDING_PHRASES.length).toBe(3);
    expect(PENDING_PHRASES[0]).toBe('Reading…');
    expect(PENDING_PHRASES[1]).toBe('Sketching the route…');
    expect(PENDING_PHRASES[2]).toBe('Almost there…');
  });

  it('every phrase ends with a horizontal ellipsis', () => {
    for (const p of PENDING_PHRASES) {
      expect(p.endsWith('…')).toBe(true);
    }
  });
});

describe('nextPendingIdx', () => {
  it('clamps negative input to 0', () => {
    expect(nextPendingIdx(-1)).toBe(0);
    expect(nextPendingIdx(-99)).toBe(0);
  });

  it('advances 0 → 1 → 2', () => {
    expect(nextPendingIdx(0)).toBe(1);
    expect(nextPendingIdx(1)).toBe(2);
  });

  it('clamps at the last phrase (does NOT loop back to 0)', () => {
    expect(nextPendingIdx(2)).toBe(2);
    expect(nextPendingIdx(7)).toBe(2);
  });
});

describe('phraseAt', () => {
  it('returns the phrase at a valid index', () => {
    expect(phraseAt(0)).toBe('Reading…');
    expect(phraseAt(2)).toBe('Almost there…');
  });

  it('falls back to phrase 0 for out-of-range indices', () => {
    expect(phraseAt(-1)).toBe('Reading…');
    expect(phraseAt(99)).toBe('Reading…');
  });
});
