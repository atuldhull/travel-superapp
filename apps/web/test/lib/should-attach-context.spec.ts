/**
 * Vitest specs for AE282 shouldAttachContext.
 */
import { describe, expect, it } from 'vitest';
import {
  FRESH_START_PHRASES,
  shouldAttachContext,
} from '../../src/components/aether/pulse/should-attach-context';

describe('shouldAttachContext', () => {
  it('hasContext=false → never', () => {
    expect(shouldAttachContext({ prompt: 'anything', hasContext: false })).toBe(false);
  });

  it('hasContext=true + normal follow-up → attach', () => {
    expect(shouldAttachContext({ prompt: 'make it cheaper', hasContext: true })).toBe(true);
  });

  it('"plan a new trip" → do NOT attach (fresh start)', () => {
    expect(shouldAttachContext({ prompt: 'plan a new trip to Leh', hasContext: true })).toBe(false);
  });

  it('"start over with five days in Goa" → fresh', () => {
    expect(
      shouldAttachContext({ prompt: 'start over with five days in Goa', hasContext: true }),
    ).toBe(false);
  });

  it('"forget what we had, start fresh" → fresh', () => {
    expect(
      shouldAttachContext({ prompt: 'forget what we had, start fresh', hasContext: true }),
    ).toBe(false);
  });

  it('"different trip altogether" → fresh', () => {
    expect(shouldAttachContext({ prompt: 'different trip altogether', hasContext: true })).toBe(
      false,
    );
  });

  it('"reset" alone → fresh', () => {
    expect(shouldAttachContext({ prompt: 'reset', hasContext: true })).toBe(false);
  });

  it('case-insensitive match', () => {
    expect(shouldAttachContext({ prompt: 'PLAN A NEW one', hasContext: true })).toBe(false);
  });

  it('empty prompt with context → attach (refine the existing plan)', () => {
    expect(shouldAttachContext({ prompt: '', hasContext: true })).toBe(true);
  });

  it('whitespace-only prompt → attach', () => {
    expect(shouldAttachContext({ prompt: '   ', hasContext: true })).toBe(true);
  });

  it('FRESH_START_PHRASES is non-empty', () => {
    expect(FRESH_START_PHRASES.length).toBeGreaterThan(0);
  });
});
