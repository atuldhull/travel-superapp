/**
 * Vitest specs for AE251 atlasEmptyStateCopy.
 */
import { describe, expect, it } from 'vitest';
import { atlasEmptyStateCopy } from '../../src/components/aether/atlas/empty-state';

describe('atlasEmptyStateCopy', () => {
  it('neither filter active → calm default', () => {
    expect(atlasEmptyStateCopy({ query: '', seasonOnly: false })).toBe('No places yet.');
  });

  it('text only → "No places match \\"<q>\\""', () => {
    expect(atlasEmptyStateCopy({ query: 'leh', seasonOnly: false })).toBe('No places match "leh".');
  });

  it('season only → "Nothing in season this month."', () => {
    expect(atlasEmptyStateCopy({ query: '', seasonOnly: true })).toBe(
      'Nothing in season this month.',
    );
  });

  it('text + season → hint to relax one', () => {
    expect(atlasEmptyStateCopy({ query: 'leh', seasonOnly: true })).toBe(
      'Nothing in season matches "leh". Try clearing one.',
    );
  });

  it('whitespace-only query is treated as no query', () => {
    expect(atlasEmptyStateCopy({ query: '   ', seasonOnly: true })).toBe(
      'Nothing in season this month.',
    );
  });

  it('trims the query before quoting', () => {
    expect(atlasEmptyStateCopy({ query: '  leh  ', seasonOnly: false })).toBe(
      'No places match "leh".',
    );
  });

  it('query with internal spaces preserved in quote', () => {
    expect(atlasEmptyStateCopy({ query: 'kerala backwaters', seasonOnly: false })).toBe(
      'No places match "kerala backwaters".',
    );
  });
});
