/** Vitest specs for AE425 Live trip-watch helpers. */
import { describe, expect, it } from 'vitest';
import {
  LIVE_FRESHNESS_MS,
  STALE_THRESHOLD_MS,
  presenceAgoLabel,
  presenceAnnouncement,
  presenceDotColor,
  presenceFreshness,
  presenceFreshnessLabel,
  presenceModeGlyph,
  presenceSpeedLabel,
  type LiveTripPresence,
} from '../../src/components/aether/phase3/live-trip-watch';

function frame(ageMs: number, mode = 'walking', speed: number | null = 10): LiveTripPresence {
  return {
    tripId: 't_demo',
    lat: 0,
    lng: 0,
    speedKmH: speed,
    mode,
    reportedAt: new Date(Date.now() - ageMs).toISOString(),
  };
}

describe('LIVE_FRESHNESS_MS + STALE_THRESHOLD_MS (pure)', () => {
  it('live threshold is shorter than stale', () => {
    expect(LIVE_FRESHNESS_MS).toBeLessThan(STALE_THRESHOLD_MS);
  });
  it('live threshold is a small handful of seconds', () => {
    expect(LIVE_FRESHNESS_MS).toBeGreaterThanOrEqual(10_000);
    expect(LIVE_FRESHNESS_MS).toBeLessThanOrEqual(60_000);
  });
});

describe('presenceFreshness (pure)', () => {
  const now = 1_000_000;
  function fixed(ageMs: number): LiveTripPresence {
    return {
      tripId: 't',
      lat: 0,
      lng: 0,
      speedKmH: null,
      mode: 'walking',
      reportedAt: new Date(now - ageMs).toISOString(),
    };
  }
  it('null → stale', () => {
    expect(presenceFreshness(null, now)).toBe('stale');
  });
  it('< LIVE_FRESHNESS_MS → live', () => {
    expect(presenceFreshness(fixed(LIVE_FRESHNESS_MS - 1), now)).toBe('live');
  });
  it('= LIVE_FRESHNESS_MS → live (inclusive boundary)', () => {
    expect(presenceFreshness(fixed(LIVE_FRESHNESS_MS), now)).toBe('live');
  });
  it('past live but within stale → recent', () => {
    expect(presenceFreshness(fixed(LIVE_FRESHNESS_MS + 1_000), now)).toBe('recent');
    expect(presenceFreshness(fixed(STALE_THRESHOLD_MS - 1), now)).toBe('recent');
  });
  it('past stale → stale', () => {
    expect(presenceFreshness(fixed(STALE_THRESHOLD_MS + 1_000), now)).toBe('stale');
  });
  it('future-dated (clock skew) → live (defensive)', () => {
    expect(presenceFreshness(fixed(-5_000), now)).toBe('live');
  });
  it('invalid timestamp → stale', () => {
    const bad: LiveTripPresence = {
      tripId: 't',
      lat: 0,
      lng: 0,
      speedKmH: null,
      mode: 'walking',
      reportedAt: 'not-an-iso',
    };
    expect(presenceFreshness(bad, now)).toBe('stale');
  });
});

describe('presenceFreshnessLabel (pure)', () => {
  const now = 1_000_000;
  function fixed(ageMs: number): LiveTripPresence {
    return {
      tripId: 't',
      lat: 0,
      lng: 0,
      speedKmH: null,
      mode: 'walking',
      reportedAt: new Date(now - ageMs).toISOString(),
    };
  }
  it('null → "No live signal"', () => {
    expect(presenceFreshnessLabel(null, now)).toBe('No live signal');
  });
  it('live → "Live · …" with seconds for recent', () => {
    expect(presenceFreshnessLabel(fixed(8_000), now)).toBe('Live · 8s ago');
  });
  it('recent → "Recent · …" with minutes', () => {
    expect(presenceFreshnessLabel(fixed(2 * 60_000), now)).toBe('Recent · 2m ago');
  });
  it('stale → "Stale · …" with hours', () => {
    expect(presenceFreshnessLabel(fixed(2 * 3_600_000), now)).toBe('Stale · 2h ago');
  });
});

describe('presenceDotColor (pure)', () => {
  it('each tier returns a non-empty hex / colour', () => {
    expect(presenceDotColor('live')).toMatch(/^#/);
    expect(presenceDotColor('recent')).toMatch(/^#/);
    expect(presenceDotColor('stale')).toMatch(/^#/);
  });
});

describe('presenceModeGlyph (pure)', () => {
  it('known modes map to distinct glyphs', () => {
    const modes = ['walking', 'driving', 'transit', 'still'];
    const set = new Set(modes.map(presenceModeGlyph));
    expect(set.size).toBe(modes.length);
  });
  it('unknown mode falls back to a default glyph', () => {
    expect(presenceModeGlyph('nope')).toBe('◆');
  });
  it('case-insensitive', () => {
    expect(presenceModeGlyph('WALKING')).toBe(presenceModeGlyph('walking'));
  });
});

describe('presenceSpeedLabel (pure)', () => {
  it('null → em-dash speed', () => {
    expect(presenceSpeedLabel(null)).toBe('— km/h');
  });
  it('rounds to nearest integer km/h', () => {
    expect(presenceSpeedLabel(12.4)).toBe('12 km/h');
    expect(presenceSpeedLabel(12.6)).toBe('13 km/h');
  });
  it('NaN → em-dash speed', () => {
    expect(presenceSpeedLabel(Number.NaN)).toBe('— km/h');
  });
});

describe('presenceAnnouncement (pure)', () => {
  it('null frame → "No live presence"', () => {
    expect(presenceAnnouncement(null)).toBe('No live presence');
  });
  it('folds freshness + mode + speed into one sr-only line', () => {
    const f = frame(5_000);
    const line = presenceAnnouncement(f);
    expect(line).toContain('Live trip-watch');
    expect(line.toLowerCase()).toContain('walking');
    expect(line).toContain('km/h');
  });
});

describe('presenceAgoLabel (pure, AE440)', () => {
  it('sub-minute deltas render as "Xs ago"', () => {
    expect(presenceAgoLabel(0)).toBe('0s ago');
    expect(presenceAgoLabel(8_000)).toBe('8s ago');
    expect(presenceAgoLabel(59_999)).toBe('59s ago');
  });
  it('sub-hour deltas render as "Xm ago"', () => {
    expect(presenceAgoLabel(60_000)).toBe('1m ago');
    expect(presenceAgoLabel(180_000)).toBe('3m ago');
    expect(presenceAgoLabel(3_599_999)).toBe('59m ago');
  });
  it('hour-scale deltas render as "Xh ago"', () => {
    expect(presenceAgoLabel(3_600_000)).toBe('1h ago');
    expect(presenceAgoLabel(7_200_000)).toBe('2h ago');
    expect(presenceAgoLabel(48 * 3_600_000)).toBe('48h ago');
  });
  it('negative deltas clamp to 0s', () => {
    expect(presenceAgoLabel(-100_000)).toBe('0s ago');
  });
  it('NaN / Infinity collapse to "0s ago"', () => {
    expect(presenceAgoLabel(Number.NaN)).toBe('0s ago');
    expect(presenceAgoLabel(Number.POSITIVE_INFINITY)).toBe('0s ago');
    expect(presenceAgoLabel(Number.NEGATIVE_INFINITY)).toBe('0s ago');
  });
  it('presenceFreshnessLabel routes through presenceAgoLabel', () => {
    const ago: LiveTripPresence = {
      tripId: 't',
      lat: 0,
      lng: 0,
      speedKmH: 0,
      mode: 'still',
      reportedAt: new Date(Date.now() - 8_000).toISOString(),
    };
    const label = presenceFreshnessLabel(ago);
    expect(label).toContain('Live · ');
    expect(label).toMatch(/[0-9]+s ago$/);
  });
});
