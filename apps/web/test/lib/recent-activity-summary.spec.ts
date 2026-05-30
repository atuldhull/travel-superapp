/**
 * Vitest specs for AE280 summariseRecentActivity.
 */
import { describe, expect, it } from 'vitest';
import { summariseRecentActivity } from '../../src/components/aether/me/recent-activity-summary';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('summariseRecentActivity', () => {
  it('empty input → null', () => {
    expect(summariseRecentActivity([], NOW)).toBeNull();
  });

  it('all-null trips → null', () => {
    expect(
      summariseRecentActivity(
        [{ title: 'a', createdAt: null, updatedAt: null, archivedAt: null }],
        NOW,
      ),
    ).toBeNull();
  });

  it('picks the most recent createdAt with verb Drafted', () => {
    const got = summariseRecentActivity(
      [
        { title: 'a', createdAt: '2026-06-01T12:00:00Z', updatedAt: null },
        { title: 'b', createdAt: '2026-06-14T12:00:00Z', updatedAt: null },
      ],
      NOW,
    );
    expect(got?.verb).toBe('Drafted');
    expect(got?.title).toBe('b');
    expect(got?.line.startsWith('Drafted b · ')).toBe(true);
  });

  it('uses updatedAt when it is later than createdAt', () => {
    const got = summariseRecentActivity(
      [
        {
          title: 'a',
          createdAt: '2026-06-01T12:00:00Z',
          updatedAt: '2026-06-14T12:00:00Z',
        },
      ],
      NOW,
    );
    expect(got?.verb).toBe('Edited');
    expect(got?.title).toBe('a');
  });

  it('archivedAt wins when it is most recent', () => {
    const got = summariseRecentActivity(
      [
        {
          title: 'a',
          createdAt: '2026-06-01T12:00:00Z',
          updatedAt: '2026-06-02T12:00:00Z',
          archivedAt: '2026-06-14T12:00:00Z',
        },
      ],
      NOW,
    );
    expect(got?.verb).toBe('Archived');
  });

  it('does NOT count updatedAt when it equals createdAt (no edit)', () => {
    const got = summariseRecentActivity(
      [
        {
          title: 'a',
          createdAt: '2026-06-14T12:00:00Z',
          updatedAt: '2026-06-14T12:00:00Z',
        },
      ],
      NOW,
    );
    expect(got?.verb).toBe('Drafted');
  });

  it('line uses AE253 relative-time format', () => {
    const got = summariseRecentActivity(
      [{ title: 'a', createdAt: '2026-06-15T11:00:00Z', updatedAt: null }],
      NOW,
    );
    expect(got?.line).toContain('1h ago');
  });

  it('ties resolve to the earlier-encountered candidate', () => {
    const got = summariseRecentActivity(
      [
        { title: 'a', createdAt: '2026-06-14T12:00:00Z', updatedAt: null },
        { title: 'b', createdAt: '2026-06-14T12:00:00Z', updatedAt: null },
      ],
      NOW,
    );
    // First encountered (a) wins on tie.
    expect(got?.title).toBe('a');
  });
});
