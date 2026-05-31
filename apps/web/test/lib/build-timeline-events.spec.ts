/**
 * Vitest specs for AE338 buildTimelineEvents.
 */
import { describe, expect, it } from 'vitest';
import { buildTimelineEvents } from '../../src/components/aether/journey/build-timeline-events';

const emptyTrip = {
  createdAt: null,
  updatedAt: null,
  archivedAt: null,
  version: null,
};

describe('buildTimelineEvents', () => {
  it('empty trip + no shares → []', () => {
    expect(buildTimelineEvents({ trip: emptyTrip, shares: [] })).toEqual([]);
  });

  it('createdAt only → single "Drafted" event', () => {
    const out = buildTimelineEvents({
      trip: { ...emptyTrip, createdAt: '2026-05-01T10:00:00Z' },
      shares: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('create');
    expect(out[0]?.label).toBe('Drafted');
  });

  it('updatedAt === createdAt suppresses the Edited event', () => {
    const t = '2026-05-01T10:00:00Z';
    const out = buildTimelineEvents({
      trip: { ...emptyTrip, createdAt: t, updatedAt: t, version: 1 },
      shares: [],
    });
    expect(out.map((e) => e.kind)).toEqual(['create']);
  });

  it('updatedAt later → Edited event w/ version label', () => {
    const out = buildTimelineEvents({
      trip: {
        ...emptyTrip,
        createdAt: '2026-05-01T10:00:00Z',
        updatedAt: '2026-05-02T10:00:00Z',
        version: 3,
      },
      shares: [],
    });
    const edit = out.find((e) => e.kind === 'edit');
    expect(edit?.label).toBe('Edited — version 3');
  });

  it('null version → "Edited" without the version suffix', () => {
    const out = buildTimelineEvents({
      trip: {
        ...emptyTrip,
        createdAt: '2026-05-01T10:00:00Z',
        updatedAt: '2026-05-02T10:00:00Z',
        version: null,
      },
      shares: [],
    });
    const edit = out.find((e) => e.kind === 'edit');
    expect(edit?.label).toBe('Edited');
  });

  it('archivedAt always appears (even if same as updatedAt)', () => {
    const t = '2026-05-09T10:00:00Z';
    const out = buildTimelineEvents({
      trip: { ...emptyTrip, archivedAt: t },
      shares: [],
    });
    expect(out.map((e) => e.kind)).toEqual(['archive']);
  });

  it('emits one event per share, with first 6 chars of code + ellipsis', () => {
    const out = buildTimelineEvents({
      trip: emptyTrip,
      shares: [
        { createdAt: '2026-05-01T10:00:00Z', shareCode: 'ABC123XYZ' },
        { createdAt: '2026-05-02T10:00:00Z', shareCode: 'short' },
      ],
    });
    const shares = out.filter((e) => e.kind === 'share');
    expect(shares).toHaveLength(2);
    expect(shares[0]?.label).toBe('Shared a link · ABC123…');
    expect(shares[1]?.label).toBe('Shared a link · short…');
  });

  it('shares without createdAt are dropped', () => {
    const out = buildTimelineEvents({
      trip: emptyTrip,
      shares: [
        { createdAt: null, shareCode: 'nope' },
        { createdAt: '2026-05-01T10:00:00Z', shareCode: 'yes123' },
      ],
    });
    expect(out.filter((e) => e.kind === 'share')).toHaveLength(1);
  });

  it('output is ordered ascending by .at', () => {
    const out = buildTimelineEvents({
      trip: {
        createdAt: '2026-05-05T10:00:00Z',
        updatedAt: '2026-05-10T10:00:00Z',
        archivedAt: '2026-05-09T10:00:00Z',
        version: 2,
      },
      shares: [{ createdAt: '2026-05-07T10:00:00Z', shareCode: 'share1' }],
    });
    const dates = out.map((e) => e.at);
    expect(dates).toEqual([...dates].sort());
    expect(out.map((e) => e.kind)).toEqual(['create', 'share', 'archive', 'edit']);
  });

  it('full deck: create + edit + share + archive', () => {
    const out = buildTimelineEvents({
      trip: {
        createdAt: '2026-05-01T10:00:00Z',
        updatedAt: '2026-05-05T10:00:00Z',
        archivedAt: '2026-05-09T10:00:00Z',
        version: 4,
      },
      shares: [
        { createdAt: '2026-05-02T10:00:00Z', shareCode: 'aaa111' },
        { createdAt: '2026-05-03T10:00:00Z', shareCode: 'bbb222' },
      ],
    });
    expect(out.map((e) => e.kind)).toEqual(['create', 'share', 'share', 'edit', 'archive']);
  });
});
