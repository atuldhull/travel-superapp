/**
 * Vitest specs for the AE164 parseChecklistBackup helper.
 *
 * Covers both shapes the importer accepts: the AE119 download payload
 * `{version, tripId, exportedAt, items: ChecklistItem[]}` and a raw
 * array. Validates each item structurally; returns null on any
 * unparseable / wrong-shape / no-valid-items input.
 */
import { describe, expect, it } from 'vitest';
import { parseChecklistBackup } from '../../src/components/aether/journey/parse-checklist-backup';

describe('parseChecklistBackup', () => {
  it('returns null when the JSON is malformed', () => {
    expect(parseChecklistBackup('not-json{{{')).toBeNull();
    expect(parseChecklistBackup('')).toBeNull();
  });

  it('returns null when there are no valid items (empty array)', () => {
    expect(parseChecklistBackup('[]')).toBeNull();
    expect(parseChecklistBackup(JSON.stringify({ items: [] }))).toBeNull();
  });

  it('parses an AE119 download payload', () => {
    const payload = {
      version: 1,
      tripId: 'trip-x',
      exportedAt: '2026-05-30T00:00:00Z',
      items: [
        { id: 'k1', text: 'Photo ID', done: false },
        { id: 'k2', text: 'Cash', done: true },
      ],
    };
    const got = parseChecklistBackup(JSON.stringify(payload));
    expect(got).toEqual(payload.items);
  });

  it('also accepts a raw ChecklistItem[] (no wrapper)', () => {
    const items = [{ id: 'a', text: 'pack', done: false }];
    expect(parseChecklistBackup(JSON.stringify(items))).toEqual(items);
  });

  it('drops items missing any required field', () => {
    const mixed = [
      { id: 'k1', text: 'ok', done: false },
      { id: 'k2', text: 'no-done' }, // missing done
      { id: 'k3', done: true }, // missing text
      { text: 't', done: false }, // missing id
      { id: 'k4', text: 'wrong-type', done: 'yes' }, // wrong type
      { id: 'k5', text: 'good again', done: true },
    ];
    const got = parseChecklistBackup(JSON.stringify({ items: mixed }));
    expect(got?.map((it) => it.id)).toEqual(['k1', 'k5']);
  });

  it('returns null on object payloads with no items key + non-array value', () => {
    expect(parseChecklistBackup(JSON.stringify({ stuff: 'no' }))).toBeNull();
    expect(parseChecklistBackup(JSON.stringify({ items: 'not-array' }))).toBeNull();
  });

  it('handles a single-item array', () => {
    const got = parseChecklistBackup(JSON.stringify([{ id: 'k1', text: 'only', done: false }]));
    expect(got).toEqual([{ id: 'k1', text: 'only', done: false }]);
  });
});
