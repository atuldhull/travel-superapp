/**
 * Vitest specs for the AE201 makeChecklistItemId helper.
 */
import { describe, expect, it } from 'vitest';
import { makeChecklistItemId } from '../../src/components/aether/journey/checklist-id';

describe('makeChecklistItemId', () => {
  it('produces an id with the user-prefix shape u-<ts>-<rand>', () => {
    const id = makeChecklistItemId(1_716_000_000_000, 0.5);
    expect(id).toMatch(/^u-[a-z0-9]+-[a-z0-9]+$/);
    expect(id.startsWith('u-')).toBe(true);
  });

  it('encodes the timestamp in base36', () => {
    const id = makeChecklistItemId(1_000_000, 0);
    expect(id).toBe('u-' + (1_000_000).toString(36) + '-0');
  });

  it('encodes a base36 fragment from the random number', () => {
    // Math.floor(0.9999 * 1e4) = 9999 → base36 "7pr"
    const id = makeChecklistItemId(0, 0.9999);
    expect(id.endsWith('-7pr')).toBe(true);
  });

  it('two calls with different timestamps yield different ids', () => {
    const a = makeChecklistItemId(1, 0);
    const b = makeChecklistItemId(2, 0);
    expect(a).not.toBe(b);
  });

  it('rand=0 yields a trailing "0" (not negative or NaN)', () => {
    const id = makeChecklistItemId(0, 0);
    expect(id).toMatch(/-0$/);
  });

  it('rand just below 1 produces 4-char-or-less base36 (cap 9999)', () => {
    // Math.floor((1 - 1e-9) * 1e4) = 9999 → "7pr" (3 chars).
    const id = makeChecklistItemId(0, 1 - 1e-9);
    expect(id.endsWith('-7pr')).toBe(true);
  });
});
