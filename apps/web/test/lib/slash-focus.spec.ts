/**
 * Vitest specs for the AE144 `/` Atlas filter shortcut guard.
 *
 * The pure helper short-circuits when:
 *   • the key isn't '/'
 *   • the focused element is a form field (so users typing slashes
 *     in the filter itself, the Pulse drawer, or any select don't
 *     loop their focus)
 *
 * Mirrors the runtime gate used in atlas-canvas.tsx.
 */
import { describe, expect, it } from 'vitest';
import { shouldFocusFilterOnSlash } from '../../src/components/aether/atlas/slash-focus';

describe('shouldFocusFilterOnSlash', () => {
  it('returns true for "/" when focus is on the document body', () => {
    expect(shouldFocusFilterOnSlash('/', { tagName: 'BODY' })).toBe(true);
  });

  it('returns false for non-slash keys', () => {
    for (const key of ['?', 'a', 'Enter', 'Escape', '', '/foo']) {
      expect(shouldFocusFilterOnSlash(key, { tagName: 'BODY' })).toBe(false);
    }
  });

  it('returns false when the focused element is an INPUT (no loop)', () => {
    expect(shouldFocusFilterOnSlash('/', { tagName: 'INPUT' })).toBe(false);
  });

  it('returns false when focus is in a TEXTAREA (Pulse drawer guard)', () => {
    expect(shouldFocusFilterOnSlash('/', { tagName: 'TEXTAREA' })).toBe(false);
  });

  it('returns false when focus is on a SELECT', () => {
    expect(shouldFocusFilterOnSlash('/', { tagName: 'SELECT' })).toBe(false);
  });

  it('handles missing target safely', () => {
    expect(shouldFocusFilterOnSlash('/', null)).toBe(true);
    expect(shouldFocusFilterOnSlash('/', undefined)).toBe(true);
    expect(shouldFocusFilterOnSlash('/', {})).toBe(true);
  });
});
