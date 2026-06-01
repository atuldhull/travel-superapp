/** Vitest specs for AE421 Mirror globe + audit-river helpers. */
import { describe, expect, it } from 'vitest';
import {
  MIRROR_AUDIT_RIVER_TTL_MS,
  MIRROR_GLOBE_RADIUS,
  auditGlyphColor,
  auditGlyphSymbol,
  auditRowYProgress,
  isMirrorViewer,
  latLngToVec3,
  liveAuditRows,
  scamClusterRadius,
  sosDotRadius,
  type MirrorAuditRow,
} from '../../src/components/aether/phase3/mirror-globe';

function row(id: string, kind: string, emittedAtMs: number): MirrorAuditRow {
  return { id, kind, emittedAt: new Date(emittedAtMs).toISOString(), summary: id };
}

describe('MIRROR_* constants (pure)', () => {
  it('TTL is roughly one minute per spec', () => {
    expect(MIRROR_AUDIT_RIVER_TTL_MS).toBeGreaterThanOrEqual(30_000);
    expect(MIRROR_AUDIT_RIVER_TTL_MS).toBeLessThanOrEqual(120_000);
  });
  it('globe radius is positive', () => {
    expect(MIRROR_GLOBE_RADIUS).toBeGreaterThan(0);
  });
});

describe('latLngToVec3 (pure)', () => {
  it('point on sphere has the right radius', () => {
    const [x, y, z] = latLngToVec3(28.6139, 77.209);
    const r = Math.sqrt(x * x + y * y + z * z);
    expect(r).toBeCloseTo(MIRROR_GLOBE_RADIUS, 5);
  });
  it('honours custom radius', () => {
    const [x, y, z] = latLngToVec3(0, 0, 10);
    const r = Math.sqrt(x * x + y * y + z * z);
    expect(r).toBeCloseTo(10, 5);
  });
  it('north pole sits at +Y', () => {
    const [x, y, z] = latLngToVec3(90, 0);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
    expect(y).toBeGreaterThan(0);
  });
  it('south pole sits at -Y', () => {
    const [x, y, z] = latLngToVec3(-90, 0);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
    expect(y).toBeLessThan(0);
  });
  it('NaN coords collapse to a safe default on the +Z axis', () => {
    const [x, y, z] = latLngToVec3(Number.NaN, 0);
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(z).toBeGreaterThan(0);
  });
});

describe('sosDotRadius (pure)', () => {
  it('severity 1 is the floor', () => {
    expect(sosDotRadius(1)).toBeCloseTo(0.04, 5);
  });
  it('severity 5 is the ceiling', () => {
    expect(sosDotRadius(5)).toBeCloseTo(0.16, 5);
  });
  it('severity 3 is in the middle', () => {
    expect(sosDotRadius(3)).toBeCloseTo(0.1, 5);
  });
  it('clamps below 1', () => {
    expect(sosDotRadius(0)).toBeCloseTo(0.04, 5);
  });
  it('clamps above 5', () => {
    expect(sosDotRadius(99)).toBeCloseTo(0.16, 5);
  });
  it('NaN → floor', () => {
    expect(sosDotRadius(Number.NaN)).toBeCloseTo(0.04, 5);
  });
});

describe('scamClusterRadius (pure)', () => {
  it('uses sqrt scaling so 100 reports is not 10× a 10-report cluster', () => {
    const r10 = scamClusterRadius(10);
    const r100 = scamClusterRadius(100);
    expect(r100 / r10).toBeLessThan(5);
    expect(r100 / r10).toBeGreaterThan(1);
  });
  it('zero / negative reports → tiny visible dot', () => {
    expect(scamClusterRadius(0)).toBeCloseTo(0.05, 5);
    expect(scamClusterRadius(-3)).toBeCloseTo(0.05, 5);
  });
  it('cap at 0.5 world units', () => {
    expect(scamClusterRadius(1_000_000)).toBe(0.5);
  });
});

describe('liveAuditRows (pure)', () => {
  it('drops rows past TTL', () => {
    const now = 1_000_000;
    const rows = [
      row('fresh', 'mutation', now - 5_000),
      row('stale', 'mutation', now - MIRROR_AUDIT_RIVER_TTL_MS - 5_000),
    ];
    const live = liveAuditRows(rows, now);
    expect(live.map((r) => r.id)).toEqual(['fresh']);
  });
  it('keeps rows exactly at the TTL boundary', () => {
    const now = 1_000_000;
    const rows = [row('boundary', 'sos', now - MIRROR_AUDIT_RIVER_TTL_MS)];
    expect(liveAuditRows(rows, now)).toHaveLength(1);
  });
  it('honours custom TTL', () => {
    const now = 1_000_000;
    const rows = [row('mid', 'sos', now - 15_000)];
    expect(liveAuditRows(rows, now, 10_000)).toHaveLength(0);
    expect(liveAuditRows(rows, now, 30_000)).toHaveLength(1);
  });
  it('drops rows with invalid emittedAt', () => {
    const rows = [{ id: 'bad', kind: 'sos', emittedAt: 'not-an-iso', summary: '' }];
    expect(liveAuditRows(rows)).toHaveLength(0);
  });
});

describe('auditRowYProgress (pure)', () => {
  it('just-emitted row → 0', () => {
    const now = 1_000_000;
    expect(auditRowYProgress(row('r', 'sos', now), now)).toBe(0);
  });
  it('mid-TTL → 0.5', () => {
    const now = 1_000_000;
    const r = row('r', 'sos', now - MIRROR_AUDIT_RIVER_TTL_MS / 2);
    expect(auditRowYProgress(r, now)).toBeCloseTo(0.5, 3);
  });
  it('past TTL → 1', () => {
    const now = 1_000_000;
    const r = row('r', 'sos', now - MIRROR_AUDIT_RIVER_TTL_MS - 1_000);
    expect(auditRowYProgress(r, now)).toBe(1);
  });
  it('invalid emittedAt → 1 (drop to bottom)', () => {
    const r: MirrorAuditRow = { id: 'r', kind: 'sos', emittedAt: 'not-an-iso', summary: '' };
    expect(auditRowYProgress(r)).toBe(1);
  });
});

describe('auditGlyphColor + auditGlyphSymbol (pure)', () => {
  it('every known kind has distinct color + symbol', () => {
    const kinds = ['mutation', 'read', 'sos', 'scam', 'admin-action'];
    const colors = new Set(kinds.map(auditGlyphColor));
    const symbols = new Set(kinds.map(auditGlyphSymbol));
    expect(colors.size).toBe(kinds.length);
    expect(symbols.size).toBe(kinds.length);
  });
  it('unknown kind → fallback', () => {
    expect(auditGlyphColor('nope')).toBe('#F2E8D5');
    expect(auditGlyphSymbol('nope')).toBe('·');
  });
});

describe('isMirrorViewer (pure)', () => {
  it('admin / superadmin allowed', () => {
    expect(isMirrorViewer('admin')).toBe(true);
    expect(isMirrorViewer('superadmin')).toBe(true);
  });
  it('everyone else denied', () => {
    expect(isMirrorViewer('user')).toBe(false);
    expect(isMirrorViewer(null)).toBe(false);
    expect(isMirrorViewer(undefined)).toBe(false);
    expect(isMirrorViewer('')).toBe(false);
  });
});

describe('liveAuditRows + auditRowYProgress (AE445 edge cases)', () => {
  function row(id: string, kind: string, when: number) {
    return { id, kind, emittedAt: new Date(when).toISOString(), summary: `${kind} ${id}` };
  }
  it('empty array → empty result', () => {
    expect(liveAuditRows([])).toHaveLength(0);
  });
  it('every row past TTL → empty result', () => {
    const now = 1_000_000;
    const rows = [
      row('a', 'mutation', now - MIRROR_AUDIT_RIVER_TTL_MS - 1),
      row('b', 'sos', now - MIRROR_AUDIT_RIVER_TTL_MS - 100_000),
    ];
    expect(liveAuditRows(rows, now)).toHaveLength(0);
  });
  it('future-dated row (clock skew) is kept (now - t < 0 < ttl)', () => {
    const now = 1_000_000;
    const rows = [row('future', 'mutation', now + 5_000)];
    expect(liveAuditRows(rows, now)).toHaveLength(1);
  });
  it('preserves input ordering', () => {
    const now = 1_000_000;
    const rows = [
      row('first', 'mutation', now - 100),
      row('second', 'sos', now - 50),
      row('third', 'scam', now - 25),
    ];
    expect(liveAuditRows(rows, now).map((r) => r.id)).toEqual(['first', 'second', 'third']);
  });
  it('1000-row array runs in linear time (sanity check)', () => {
    const now = 2_000_000;
    const rows = Array.from({ length: 1000 }, (_, i) =>
      row(`r-${i}`, 'mutation', now - (i % 200) * 100),
    );
    const start = performance.now();
    const live = liveAuditRows(rows, now);
    const took = performance.now() - start;
    expect(live.length).toBeGreaterThan(0);
    // < 50ms is more than enough for a 1000-row filter on any modern host.
    expect(took).toBeLessThan(50);
  });
  it('auditRowYProgress: invalid timestamp returns 1 (fallen off)', () => {
    const bad = { id: 'bad', kind: 'mutation', emittedAt: 'no', summary: '' };
    expect(auditRowYProgress(bad)).toBe(1);
  });
  it('auditRowYProgress: future-dated row returns 0', () => {
    const now = 1_000_000;
    const r = row('future', 'mutation', now + 10_000);
    expect(auditRowYProgress(r, now)).toBe(0);
  });
  it('auditRowYProgress: row past TTL returns 1', () => {
    const now = 1_000_000;
    const r = row('past', 'mutation', now - MIRROR_AUDIT_RIVER_TTL_MS - 1_000);
    expect(auditRowYProgress(r, now)).toBe(1);
  });
});
