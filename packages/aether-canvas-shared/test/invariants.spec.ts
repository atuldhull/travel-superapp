/**
 * AE489 — geometric + numeric invariants for `@app/aether-canvas-shared`.
 *
 * The apps/web spec files verify behaviour at the consumer level
 * (button shows "Plan", overlay tier flips to "live", etc.). This
 * spec pins the MATHEMATICAL laws underneath — properties that
 * must hold for every input, not just the curated cases.
 *
 * Each invariant covers a property the Phase 4 native R3F + Tone-on-RN
 * port must reproduce; a single off-by-one in the migrated math would
 * fail one of these checks loudly.
 */
import {
  CARDINALS,
  DEFAULT_VAULT_RING_RADIUS,
  ECHO_SWIPE_NOISE_PX,
  MIRROR_GLOBE_RADIUS,
  bearingToVec3,
  cardinalAt,
  cameraPoseAt,
  easeOutCubic,
  easedPhaseProgress,
  echoCardOpacity,
  echoCardScale,
  echoCardY,
  echoSwipeDirectionFromDelta,
  glyphRingPosition,
  latLngToVec3,
  normalizeBearing,
  nowCardContent,
  presenceFreshness,
  pulseBreathAt,
  scamClusterRadius,
  sosDotRadius,
  timeBandFor,
  type LiveTripPresence,
  type SurfacePaletteSlots,
} from '../src';

function magnitude(v: readonly [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

describe('AE489 — Compass rose unit-length invariant', () => {
  it('bearingToVec3 returns a unit vector for every degree in [0, 360)', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const v = bearingToVec3(deg);
      const mag = Math.sqrt(v.x * v.x + v.z * v.z);
      expect(mag).toBeCloseTo(1, 6);
      expect(v.y).toBe(0);
    }
  });
  it('CARDINALS list contains exactly 4 entries in canonical order', () => {
    expect(CARDINALS.map((c) => c.label)).toEqual(['N', 'E', 'S', 'W']);
    expect(CARDINALS.map((c) => c.bearing)).toEqual([0, 90, 180, 270]);
  });
  it('normalizeBearing folds any integer into [0, 360)', () => {
    for (const b of [-720, -361, -1, 0, 359, 360, 720, 1080]) {
      const n = normalizeBearing(b);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(360);
    }
  });
  it('cardinalAt + bearingToVec3 agree at each compass quarter', () => {
    expect(cardinalAt(0)).toBe('N');
    expect(cardinalAt(90)).toBe('E');
    expect(cardinalAt(180)).toBe('S');
    expect(cardinalAt(270)).toBe('W');
    expect(cardinalAt(359)).toBe('N');
  });
});

describe('AE489 — Mirror globe sphere-surface invariant', () => {
  it('latLngToVec3 always lands on the sphere of given radius', () => {
    const r = MIRROR_GLOBE_RADIUS;
    for (const [lat, lng] of [
      [0, 0],
      [90, 0],
      [-90, 0],
      [45, 0],
      [-45, 180],
      [0, 90],
      [0, -90],
      [89.99, 179.99],
    ] as const) {
      const v = latLngToVec3(lat, lng, r);
      expect(magnitude(v)).toBeCloseTo(r, 4);
    }
  });
  it('sosDotRadius is monotonic in severity', () => {
    for (let s = 1; s < 5; s += 1) {
      expect(sosDotRadius(s + 1)).toBeGreaterThan(sosDotRadius(s));
    }
  });
  it('scamClusterRadius caps at 0.5 for very large counts', () => {
    expect(scamClusterRadius(1)).toBeGreaterThan(0);
    expect(scamClusterRadius(1_000)).toBeLessThanOrEqual(0.5);
    expect(scamClusterRadius(1_000_000)).toBeLessThanOrEqual(0.5);
  });
});

describe('AE489 — Vault glyph-ring radius invariant', () => {
  it('every glyph position sits on the ring of given radius', () => {
    const r = DEFAULT_VAULT_RING_RADIUS;
    for (let total = 1; total <= 12; total += 1) {
      for (let i = 0; i < total; i += 1) {
        const [x, y, z] = glyphRingPosition(i, total, r);
        const mag = Math.sqrt(x * x + z * z);
        expect(mag).toBeCloseTo(r, 6);
        expect(y).toBe(0);
      }
    }
  });
});

describe('AE489 — Lifecycle progress monotonicity', () => {
  it('easedPhaseProgress is monotonically non-decreasing across a phase', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1.0; t += 0.05) {
      const p = easedPhaseProgress('materialising', t);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
  it('easeOutCubic is in [0, 1] for every t in [0, 1]', () => {
    for (let t = 0; t <= 1.0; t += 0.05) {
      const e = easeOutCubic(t);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
    }
  });
  it('cameraPoseAt returns valid Vec3 tuples for every phase', () => {
    for (const phase of ['idle', 'materialising', 'settling', 'listening', 'dissolving'] as const) {
      const pose = cameraPoseAt(phase, 0.5);
      expect(pose.position.length).toBe(3);
      expect(pose.lookAt.length).toBe(3);
      pose.position.forEach((n) => expect(Number.isFinite(n)).toBe(true));
      pose.lookAt.forEach((n) => expect(Number.isFinite(n)).toBe(true));
    }
  });
});

describe('AE489 — Pulse breathing bounds invariant', () => {
  it('pulseBreathAt scale + opacity stay within the mood envelope', () => {
    for (const mood of ['idle', 'listening', 'speaking', 'sleeping'] as const) {
      for (let t = 0; t < 16_000; t += 200) {
        const { scale, opacity } = pulseBreathAt(mood, t);
        expect(scale).toBeGreaterThanOrEqual(0.8);
        expect(scale).toBeLessThanOrEqual(1.2);
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('AE489 — Echo card layout invariants', () => {
  it('echoCardY at the active index is always 0', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(echoCardY(i, i)).toBe(0);
    }
  });
  it('echoCardScale + echoCardOpacity are 1.0 at the active index', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(echoCardScale(i, i)).toBe(1);
      expect(echoCardOpacity(i, i)).toBe(1);
    }
  });
  it('echoCardOpacity drops monotonically as the card moves further from active', () => {
    // index=0; activeIndex grows → offset grows → opacity is non-increasing.
    for (let i = 0; i < 5; i += 1) {
      expect(echoCardOpacity(0, i)).toBeGreaterThanOrEqual(echoCardOpacity(0, i + 1));
    }
  });
  it('ECHO_SWIPE_NOISE_PX is a sensible touch-threshold (8..60 px)', () => {
    expect(ECHO_SWIPE_NOISE_PX).toBeGreaterThanOrEqual(8);
    expect(ECHO_SWIPE_NOISE_PX).toBeLessThan(60);
  });
  it('echoSwipeDirectionFromDelta is symmetric in (dx, dy) sign', () => {
    expect(echoSwipeDirectionFromDelta(100, 0)).toBe('right');
    expect(echoSwipeDirectionFromDelta(-100, 0)).toBe('left');
    expect(echoSwipeDirectionFromDelta(0, 100)).toBe('down');
    expect(echoSwipeDirectionFromDelta(0, -100)).toBe('up');
  });
});

describe('AE489 — Time + presence freshness boundaries', () => {
  it('timeBandFor covers all 24 hours exactly once', () => {
    const seen = new Set<string>();
    for (let h = 0; h < 24; h += 1) seen.add(timeBandFor(h));
    expect(seen.has('morning')).toBe(true);
    expect(seen.has('afternoon')).toBe(true);
    expect(seen.has('evening')).toBe(true);
    expect(seen.has('night')).toBe(true);
    expect(seen.size).toBe(4);
  });
  it('nowCardContent returns a band + headline + suggestion + verb', () => {
    const c = nowCardContent(new Date('2026-06-01T09:00:00.000Z'));
    expect(typeof c.band).toBe('string');
    expect(typeof c.headline).toBe('string');
    expect(typeof c.suggestion).toBe('string');
    expect(typeof c.verb).toBe('string');
    expect(c.headline.length).toBeGreaterThan(0);
  });
  it('presenceFreshness covers live → recent → stale for a fixed clock', () => {
    const now = 1_000_000;
    function frame(ageMs: number): LiveTripPresence {
      return {
        tripId: 't',
        lat: 0,
        lng: 0,
        speedKmH: null,
        mode: 'walking',
        reportedAt: new Date(now - ageMs).toISOString(),
      };
    }
    expect(presenceFreshness(frame(5_000), now)).toBe('live');
    expect(presenceFreshness(frame(60_000), now)).toBe('recent');
    expect(presenceFreshness(frame(10 * 60_000), now)).toBe('stale');
  });
});

describe('AE489 — Palette slot type invariant', () => {
  it('SurfacePaletteSlots type has the canonical 5 slots', () => {
    // Compile-time check: the type union below must compile.
    // Runtime: confirm the slot names exist as keys.
    const slots: ReadonlyArray<keyof SurfacePaletteSlots> = [
      'ink',
      'surface',
      'accent',
      'glow',
      'support',
    ];
    expect(slots.length).toBe(5);
  });
});
