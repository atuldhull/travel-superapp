/**
 * Vitest specs for the AE188 backupFilename helper.
 */
import { describe, expect, it } from 'vitest';
import { backupFilename } from '../../src/lib/backup-filename';

const FIXED = new Date('2026-05-30T12:00:00Z');

describe('backupFilename', () => {
  it('renders aether-<scope>-<YYYY-MM-DD>.json', () => {
    expect(backupFilename('checklist-trip-x', FIXED)).toBe(
      'aether-checklist-trip-x-2026-05-30.json',
    );
  });

  it('replaces unsafe characters with dashes', () => {
    expect(backupFilename('weird $cope!! name', FIXED)).toBe(
      'aether-weird-cope-name-2026-05-30.json',
    );
  });

  it('trims leading + trailing whitespace and dashes', () => {
    expect(backupFilename('  -checklist-  ', FIXED)).toBe('aether-checklist-2026-05-30.json');
  });

  it('honours pulse-history + my-data scopes used by AE131/AE140', () => {
    expect(backupFilename('pulse-history', FIXED)).toBe('aether-pulse-history-2026-05-30.json');
    expect(backupFilename('my-data', FIXED)).toBe('aether-my-data-2026-05-30.json');
  });

  it('uses the current date when `now` is omitted', () => {
    const got = backupFilename('any');
    expect(got).toMatch(/^aether-any-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('preserves underscores and digits', () => {
    expect(backupFilename('trip_007-leh2026', FIXED)).toBe(
      'aether-trip_007-leh2026-2026-05-30.json',
    );
  });

  it('always ends in ".json"', () => {
    for (const scope of ['a', 'b-c', 'checklist-x']) {
      expect(backupFilename(scope, FIXED).endsWith('.json')).toBe(true);
    }
  });
});
