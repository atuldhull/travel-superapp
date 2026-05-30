/**
 * Vitest specs for AE261 matchQuickPrompt + quickPrompts.
 */
import { describe, expect, it } from 'vitest';
import {
  matchQuickPrompt,
  quickPrompts,
} from '../../src/components/aether/pulse/match-quick-prompt';

describe('quickPrompts', () => {
  it('returns all 4 routes', () => {
    expect(quickPrompts()).toHaveLength(4);
  });
  it('every route has label/kind/href', () => {
    for (const r of quickPrompts()) {
      expect(typeof r.label).toBe('string');
      expect(typeof r.kind).toBe('string');
      expect(typeof r.href).toBe('string');
      expect(r.href.startsWith('/aether/')).toBe(true);
    }
  });
  it('kinds are unique', () => {
    const kinds = new Set(quickPrompts().map((r) => r.kind));
    expect(kinds.size).toBe(quickPrompts().length);
  });
});

describe('matchQuickPrompt', () => {
  it('plan a trip → /aether/plan', () => {
    expect(matchQuickPrompt('Plan a trip')).toEqual({ kind: 'plan', href: '/aether/plan' });
  });
  it('your journeys → /aether/me/journeys', () => {
    expect(matchQuickPrompt('Your journeys')).toEqual({
      kind: 'mine',
      href: '/aether/me/journeys',
    });
  });
  it('find a destination → /aether/destinations', () => {
    expect(matchQuickPrompt('Find a destination')).toEqual({
      kind: 'find',
      href: '/aether/destinations',
    });
  });
  it('see the map → /aether/atlas', () => {
    expect(matchQuickPrompt('See the map')).toEqual({ kind: 'map', href: '/aether/atlas' });
  });
  it('case-insensitive match', () => {
    expect(matchQuickPrompt('PLAN A TRIP')?.kind).toBe('plan');
  });
  it('trims input', () => {
    expect(matchQuickPrompt('  see the map  ')?.kind).toBe('map');
  });
  it('miss → null', () => {
    expect(matchQuickPrompt('unknown')).toBeNull();
  });
  it('empty → null', () => {
    expect(matchQuickPrompt('')).toBeNull();
  });
});
