/**
 * Vitest specs for the Pulse recent-prompts long-memory store
 * (AE106, extracted in AE109).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PULSE_RECENT_CAP,
  PULSE_RECENT_KEY,
  appendRecentPrompt,
  readRecentPrompts,
} from '../../src/components/aether/pulse/recent-prompts';

describe('recent-prompts', () => {
  beforeEach(() => {
    window.localStorage.removeItem(PULSE_RECENT_KEY);
  });
  afterEach(() => {
    window.localStorage.removeItem(PULSE_RECENT_KEY);
  });

  it('returns [] when no entry exists', () => {
    expect(readRecentPrompts()).toEqual([]);
  });

  it('appends and persists a single prompt', () => {
    appendRecentPrompt('A trip to Jaipur');
    expect(readRecentPrompts()).toEqual(['A trip to Jaipur']);
  });

  it('trims whitespace and ignores empty prompts', () => {
    appendRecentPrompt('   ');
    appendRecentPrompt('');
    expect(readRecentPrompts()).toEqual([]);
    appendRecentPrompt('  hello  ');
    expect(readRecentPrompts()).toEqual(['hello']);
  });

  it('moves a duplicate to the front (newest wins)', () => {
    appendRecentPrompt('A');
    appendRecentPrompt('B');
    appendRecentPrompt('C');
    expect(readRecentPrompts()).toEqual(['C', 'B', 'A']);
    appendRecentPrompt('A');
    expect(readRecentPrompts()).toEqual(['A', 'C', 'B']);
  });

  it('caps the list at PULSE_RECENT_CAP entries', () => {
    for (let i = 0; i < PULSE_RECENT_CAP + 5; i += 1) {
      appendRecentPrompt(`prompt-${i}`);
    }
    const got = readRecentPrompts();
    expect(got.length).toBe(PULSE_RECENT_CAP);
    // Newest first.
    expect(got[0]).toBe(`prompt-${PULSE_RECENT_CAP + 4}`);
  });

  it('survives a corrupt localStorage payload (returns [])', () => {
    window.localStorage.setItem(PULSE_RECENT_KEY, 'this-is-not-json{{{');
    expect(readRecentPrompts()).toEqual([]);
  });

  it('survives a non-array localStorage payload (returns [])', () => {
    window.localStorage.setItem(PULSE_RECENT_KEY, JSON.stringify({ not: 'array' }));
    expect(readRecentPrompts()).toEqual([]);
  });

  it('filters out non-string entries', () => {
    window.localStorage.setItem(PULSE_RECENT_KEY, JSON.stringify(['a', 1, true, null, 'b']));
    expect(readRecentPrompts()).toEqual(['a', 'b']);
  });
});
