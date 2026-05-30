/**
 * Vitest specs for the AE141 timeline ISO-week grouping helpers
 * (extracted from journey-dashboard in AE143).
 *
 * Covers:
 *   • weekKey: Monday-rooted ISO week id (Sun shifts back, Mon→same)
 *   • weekKey: unparseable input → 'unknown' sentinel
 *   • weekLabel: 'Week of MMM D' shape on a known date
 *   • groupByWeek: collapses adjacent same-week entries, opens a new
 *     bucket at the boundary
 *   • TIMELINE_GROUP_THRESHOLD: the runtime constant used by the
 *     dashboard's flat/grouped switch
 */
import { describe, expect, it } from 'vitest';
import {
  TIMELINE_GROUP_THRESHOLD,
  countTimelineEvents,
  groupByWeek,
  weekKey,
  weekLabel,
  type TimelineEvent,
} from '../../src/components/aether/journey/timeline-grouping';

describe('weekKey', () => {
  it('snaps a Sunday to the previous Monday', () => {
    // 2026-06-07 is a Sunday → Monday before is 2026-06-01.
    expect(weekKey('2026-06-07T15:00:00Z')).toBe('2026-06-01');
  });

  it('keeps a Monday on itself', () => {
    expect(weekKey('2026-06-01T00:00:00')).toBe('2026-06-01');
  });

  it('snaps a Thursday to its Monday', () => {
    // 2026-06-04 Thu → 2026-06-01 Mon.
    expect(weekKey('2026-06-04T18:30:00')).toBe('2026-06-01');
  });

  it('returns the sentinel "unknown" for a bad string', () => {
    expect(weekKey('not-a-date')).toBe('unknown');
  });
});

describe('weekLabel', () => {
  it('renders "Week of MMM D" for a parseable date', () => {
    // We assert the shape, not the exact locale-string — Node's
    // 'en-US' gives "Week of Jun 1".
    expect(weekLabel('2026-06-01T00:00:00')).toMatch(/Week of [A-Za-z]+ \d+/);
  });

  it('falls back to the raw input on unparseable strings', () => {
    expect(weekLabel('garbage')).toBe('garbage');
  });
});

describe('groupByWeek', () => {
  const ev = (at: string, kind: TimelineEvent['kind'] = 'edit'): TimelineEvent => ({
    at,
    label: `${kind}@${at}`,
    kind,
  });

  it('returns [] for empty input', () => {
    expect(groupByWeek([])).toEqual([]);
  });

  it('puts same-week events in one bucket', () => {
    const evts = [ev('2026-06-01T10:00:00'), ev('2026-06-03T12:00:00'), ev('2026-06-07T20:00:00')];
    const got = groupByWeek(evts);
    expect(got.length).toBe(1);
    expect(got[0]?.items.length).toBe(3);
    expect(got[0]?.key).toBe('2026-06-01');
  });

  it('opens a new bucket at the week boundary', () => {
    const evts = [
      ev('2026-06-01T10:00:00'), // Mon week
      ev('2026-06-08T10:00:00'), // next Mon, new bucket
    ];
    const got = groupByWeek(evts);
    expect(got.length).toBe(2);
    expect(got[0]?.key).toBe('2026-06-01');
    expect(got[1]?.key).toBe('2026-06-08');
  });

  it('preserves event order within each bucket', () => {
    const evts = [
      ev('2026-06-01T08:00:00', 'create'),
      ev('2026-06-02T08:00:00', 'edit'),
      ev('2026-06-03T08:00:00', 'share'),
    ];
    const got = groupByWeek(evts);
    expect(got[0]?.items.map((e) => e.kind)).toEqual(['create', 'edit', 'share']);
  });
});

describe('TIMELINE_GROUP_THRESHOLD', () => {
  it('is a positive integer (sanity gate for the dashboard switch)', () => {
    expect(Number.isInteger(TIMELINE_GROUP_THRESHOLD)).toBe(true);
    expect(TIMELINE_GROUP_THRESHOLD).toBeGreaterThan(0);
  });
});

// ─── AE165: countTimelineEvents ─────────────────────────────────────
describe('countTimelineEvents', () => {
  it('returns 0 when every field is null', () => {
    expect(
      countTimelineEvents({
        createdAt: null,
        updatedAt: null,
        archivedAt: null,
        shareCreatedAts: [],
      }),
    ).toBe(0);
  });

  it('counts only createdAt for a fresh draft', () => {
    expect(
      countTimelineEvents({
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: null,
        archivedAt: null,
        shareCreatedAts: [],
      }),
    ).toBe(1);
  });

  it('does NOT double-count updatedAt when it equals createdAt', () => {
    expect(
      countTimelineEvents({
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
        archivedAt: null,
        shareCreatedAts: [],
      }),
    ).toBe(1);
  });

  it('counts an archive event', () => {
    expect(
      countTimelineEvents({
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-02T00:00:00Z',
        archivedAt: '2026-06-03T00:00:00Z',
        shareCreatedAts: [],
      }),
    ).toBe(3);
  });

  it('counts every share with a non-null createdAt', () => {
    expect(
      countTimelineEvents({
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: null,
        archivedAt: null,
        shareCreatedAts: ['2026-06-02T00:00:00Z', '2026-06-03T00:00:00Z'],
      }),
    ).toBe(3);
  });

  it('skips shares with null createdAt', () => {
    expect(
      countTimelineEvents({
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: null,
        archivedAt: null,
        shareCreatedAts: [null, '2026-06-02T00:00:00Z', null],
      }),
    ).toBe(2);
  });
});
