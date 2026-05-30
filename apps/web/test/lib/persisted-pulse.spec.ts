/**
 * Vitest specs for the AE184 parsePulseStore helper (AE72 storage
 * contract, extracted from pulse.tsx).
 */
import { describe, expect, it } from 'vitest';
import { parsePulseStore } from '../../src/components/aether/pulse/persisted-pulse';

describe('parsePulseStore', () => {
  it('returns null for null input (no key)', () => {
    expect(parsePulseStore(null)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parsePulseStore('not-json{{{')).toBeNull();
  });

  it('returns null when payload is not an object', () => {
    expect(parsePulseStore('42')).toBeNull();
    expect(parsePulseStore('"hello"')).toBeNull();
    expect(parsePulseStore('null')).toBeNull();
  });

  it('returns null when messages is not an array', () => {
    expect(parsePulseStore(JSON.stringify({ messages: 'oops' }))).toBeNull();
  });

  it('parses a minimal valid payload', () => {
    const raw = JSON.stringify({
      messages: [{ role: 'user', content: 'hi' }],
      ctx: null,
      provider: 'stub',
    });
    const got = parsePulseStore(raw);
    expect(got).not.toBeNull();
    expect(got?.messages.length).toBe(1);
    expect(got?.ctx).toBeNull();
    expect(got?.provider).toBe('stub');
  });

  it('drops malformed message entries (wrong role / missing fields)', () => {
    const raw = JSON.stringify({
      messages: [
        { role: 'user', content: 'good' },
        { role: 'bad', content: 'wrong-role' }, // dropped
        { role: 'assistant' }, // missing content
        { content: 'no role' }, // missing role
        'not-an-object', // dropped
        { role: 'assistant', content: 42 }, // non-string content
        { role: 'assistant', content: 'also-good' },
      ],
      ctx: null,
      provider: null,
    });
    const got = parsePulseStore(raw);
    expect(got?.messages.map((m) => m.content)).toEqual(['good', 'also-good']);
  });

  it('parses a full ctx with center coords', () => {
    const raw = JSON.stringify({
      messages: [],
      ctx: { title: 'Jaipur', plan: 'three days', center: { lat: 26.9, lng: 75.8 } },
      provider: null,
    });
    const got = parsePulseStore(raw);
    expect(got?.ctx).toEqual({
      title: 'Jaipur',
      plan: 'three days',
      center: { lat: 26.9, lng: 75.8 },
    });
  });

  it('returns ctx=null when center lat/lng are wrong type', () => {
    const raw = JSON.stringify({
      messages: [],
      ctx: { title: 'Jaipur', plan: 'three days', center: { lat: '26', lng: 75.8 } },
      provider: null,
    });
    const got = parsePulseStore(raw);
    expect(got?.ctx).toBeNull();
  });

  it('returns provider=null when provider is not a string', () => {
    const raw = JSON.stringify({ messages: [], ctx: null, provider: 1 });
    const got = parsePulseStore(raw);
    expect(got?.provider).toBeNull();
  });
});
