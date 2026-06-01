/**
 * AE502 - canvas-shared own behavioural spec for the Mirror (admin
 * forensics) helpers shipped in AE421.
 *
 * Covers:
 *   - latLngToVec3 sphere projection (incl. non-finite fallback)
 *   - sosDotRadius linear scale w/ clamped severity ends
 *   - scamClusterRadius sqrt scale w/ zero/negative guard + cap
 *   - liveAuditRows TTL filter (incl. malformed iso strings)
 *   - auditRowYProgress 0..1 interpolation w/ clamped ends
 *   - auditGlyphColor + auditGlyphSymbol per-kind tables w/ fallback
 *   - isMirrorViewer admin/superadmin RBAC gate
 *   - MIRROR_AUDIT_RIVER_TTL_MS + MIRROR_GLOBE_RADIUS constants
 *
 * Imports only from the package barrel so the helpers stay shippable
 * to any consumer that re-exports `@app/aether-canvas-shared`.
 */

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
} from '../src';

const ROW = (overrides: Partial<MirrorAuditRow> = {}): MirrorAuditRow => ({
  id: 'row-1',
  kind: 'read',
  emittedAt: new Date(1_700_000_000_000).toISOString(),
  summary: 'sample',
  ...overrides,
});

describe('AE502 - MIRROR constants', () => {
  it('pins the audit river TTL to 60 seconds', () => {
    expect(MIRROR_AUDIT_RIVER_TTL_MS).toBe(60_000);
  });

  it('pins the globe radius to 2.4 world units', () => {
    expect(MIRROR_GLOBE_RADIUS).toBe(2.4);
  });
});

describe('AE502 - latLngToVec3', () => {
  it('returns a 3-tuple of finite numbers for the equator/prime meridian', () => {
    const v = latLngToVec3(0, 0);
    expect(v).toHaveLength(3);
    v.forEach((n) => expect(Number.isFinite(n)).toBe(true));
  });

  it('places the north pole at +y = radius (x and z near zero)', () => {
    const [x, y, z] = latLngToVec3(90, 0, 2.4);
    expect(y).toBeCloseTo(2.4, 5);
    expect(Math.abs(x)).toBeLessThan(1e-6);
    expect(Math.abs(z)).toBeLessThan(1e-6);
  });

  it('places the south pole at -y = -radius', () => {
    const [x, y, z] = latLngToVec3(-90, 0, 2.4);
    expect(y).toBeCloseTo(-2.4, 5);
    expect(Math.abs(x)).toBeLessThan(1e-6);
    expect(Math.abs(z)).toBeLessThan(1e-6);
  });

  it('projects points onto the sphere of the supplied radius', () => {
    const r = 2.4;
    const [x, y, z] = latLngToVec3(37.5, -122.3, r);
    const mag = Math.sqrt(x * x + y * y + z * z);
    expect(mag).toBeCloseTo(r, 5);
  });

  it('honours a custom radius argument', () => {
    const [x, y, z] = latLngToVec3(0, 90, 5);
    const mag = Math.sqrt(x * x + y * y + z * z);
    expect(mag).toBeCloseTo(5, 5);
  });

  it('defaults to MIRROR_GLOBE_RADIUS when radius is omitted', () => {
    const [x, y, z] = latLngToVec3(0, 90);
    const mag = Math.sqrt(x * x + y * y + z * z);
    expect(mag).toBeCloseTo(MIRROR_GLOBE_RADIUS, 5);
  });

  it('returns [0, 0, radius] when lat is non-finite', () => {
    const v = latLngToVec3(Number.NaN, 0, 2.4);
    expect(v).toEqual([0, 0, 2.4]);
  });

  it('returns [0, 0, radius] when lng is non-finite', () => {
    const v = latLngToVec3(0, Number.POSITIVE_INFINITY, 2.4);
    expect(v).toEqual([0, 0, 2.4]);
  });
});

describe('AE502 - sosDotRadius', () => {
  it('returns 0.04 at severity 1 (low end)', () => {
    expect(sosDotRadius(1)).toBeCloseTo(0.04, 5);
  });

  it('returns 0.16 at severity 5 (high end)', () => {
    expect(sosDotRadius(5)).toBeCloseTo(0.16, 5);
  });

  it('scales linearly at severity 3 (midpoint)', () => {
    expect(sosDotRadius(3)).toBeCloseTo(0.1, 5);
  });

  it('clamps severities below 1 up to the low end', () => {
    expect(sosDotRadius(0)).toBeCloseTo(0.04, 5);
    expect(sosDotRadius(-5)).toBeCloseTo(0.04, 5);
  });

  it('clamps severities above 5 down to the high end', () => {
    expect(sosDotRadius(99)).toBeCloseTo(0.16, 5);
  });

  it('falls back to 0.04 for non-finite severity', () => {
    expect(sosDotRadius(Number.NaN)).toBeCloseTo(0.04, 5);
    expect(sosDotRadius(Number.POSITIVE_INFINITY)).toBeCloseTo(0.04, 5);
  });
});

describe('AE502 - scamClusterRadius', () => {
  it('returns the floor 0.05 when reportCount is 0', () => {
    expect(scamClusterRadius(0)).toBeCloseTo(0.05, 5);
  });

  it('returns the floor 0.05 when reportCount is negative', () => {
    expect(scamClusterRadius(-10)).toBeCloseTo(0.05, 5);
  });

  it('returns the floor 0.05 when reportCount is non-finite', () => {
    expect(scamClusterRadius(Number.NaN)).toBeCloseTo(0.05, 5);
  });

  it('scales by sqrt(count) for a small positive count', () => {
    expect(scamClusterRadius(4)).toBeCloseTo(0.05 + 2 * 0.025, 5);
  });

  it('caps the disk at 0.5 world units for huge clusters', () => {
    expect(scamClusterRadius(1_000_000)).toBeCloseTo(0.5, 5);
  });

  it('keeps a 100-report cluster less than 10x a 10-report cluster (sqrt scale check)', () => {
    const r10 = scamClusterRadius(10);
    const r100 = scamClusterRadius(100);
    expect(r100).toBeLessThan(r10 * 10);
  });
});

describe('AE502 - liveAuditRows', () => {
  it('returns an empty array when given no rows', () => {
    expect(liveAuditRows([], 0)).toEqual([]);
  });

  it('keeps rows whose age is strictly less than the TTL', () => {
    const now = 1_700_000_000_000;
    const row = ROW({ emittedAt: new Date(now - 30_000).toISOString() });
    expect(liveAuditRows([row], now)).toEqual([row]);
  });

  it('keeps rows exactly at the TTL boundary (inclusive)', () => {
    const now = 1_700_000_000_000;
    const row = ROW({ emittedAt: new Date(now - MIRROR_AUDIT_RIVER_TTL_MS).toISOString() });
    expect(liveAuditRows([row], now)).toEqual([row]);
  });

  it('drops rows just past the TTL boundary', () => {
    const now = 1_700_000_000_000;
    const row = ROW({ emittedAt: new Date(now - MIRROR_AUDIT_RIVER_TTL_MS - 1).toISOString() });
    expect(liveAuditRows([row], now)).toEqual([]);
  });

  it('drops rows with a malformed emittedAt timestamp', () => {
    const row = ROW({ emittedAt: 'not-a-date' });
    expect(liveAuditRows([row], 1_700_000_000_000)).toEqual([]);
  });

  it('respects a custom ttlMs argument', () => {
    const now = 1_700_000_000_000;
    const fresh = ROW({ id: 'a', emittedAt: new Date(now - 500).toISOString() });
    const stale = ROW({ id: 'b', emittedAt: new Date(now - 5_000).toISOString() });
    expect(liveAuditRows([fresh, stale], now, 1_000)).toEqual([fresh]);
  });
});

describe('AE502 - auditRowYProgress', () => {
  it('returns 0 for a row emitted exactly now', () => {
    const now = 1_700_000_000_000;
    const row = ROW({ emittedAt: new Date(now).toISOString() });
    expect(auditRowYProgress(row, now)).toBe(0);
  });

  it('returns 0 for a row whose emit time is in the future (clamped low end)', () => {
    const now = 1_700_000_000_000;
    const row = ROW({ emittedAt: new Date(now + 5_000).toISOString() });
    expect(auditRowYProgress(row, now)).toBe(0);
  });

  it('returns 1 for a row at exactly the TTL age', () => {
    const now = 1_700_000_000_000;
    const row = ROW({ emittedAt: new Date(now - MIRROR_AUDIT_RIVER_TTL_MS).toISOString() });
    expect(auditRowYProgress(row, now)).toBe(1);
  });

  it('returns 1 for a row well past the TTL (clamped high end)', () => {
    const now = 1_700_000_000_000;
    const row = ROW({ emittedAt: new Date(now - 10 * MIRROR_AUDIT_RIVER_TTL_MS).toISOString() });
    expect(auditRowYProgress(row, now)).toBe(1);
  });

  it('interpolates linearly through the river (halfway)', () => {
    const now = 1_700_000_000_000;
    const row = ROW({ emittedAt: new Date(now - MIRROR_AUDIT_RIVER_TTL_MS / 2).toISOString() });
    expect(auditRowYProgress(row, now)).toBeCloseTo(0.5, 5);
  });

  it('returns 1 when emittedAt is malformed', () => {
    const row = ROW({ emittedAt: 'definitely-not-iso' });
    expect(auditRowYProgress(row, 1_700_000_000_000)).toBe(1);
  });
});

describe('AE502 - auditGlyphColor', () => {
  it('maps mutation to terracotta', () => {
    expect(auditGlyphColor('mutation')).toMatch(/^#C2614A$/i);
  });

  it('maps read to paper', () => {
    expect(auditGlyphColor('read')).toMatch(/^#F2E8D5$/i);
  });

  it('maps sos to bright red', () => {
    expect(auditGlyphColor('sos')).toMatch(/^#E04A4A$/i);
  });

  it('maps scam to ochre', () => {
    expect(auditGlyphColor('scam')).toMatch(/^#E8B777$/i);
  });

  it('maps admin-action to olive', () => {
    expect(auditGlyphColor('admin-action')).toMatch(/^#6E7B5C$/i);
  });

  it('falls back to surface paper for unknown kinds', () => {
    expect(auditGlyphColor('something-else')).toMatch(/^#F2E8D5$/i);
    expect(auditGlyphColor('')).toMatch(/^#F2E8D5$/i);
  });
});

describe('AE502 - auditGlyphSymbol', () => {
  it('maps every known kind to a single distinguishing glyph', () => {
    expect(auditGlyphSymbol('mutation')).toBe('◆');
    expect(auditGlyphSymbol('read')).toBe('•');
    expect(auditGlyphSymbol('sos')).toBe('!');
    expect(auditGlyphSymbol('scam')).toBe('⚠');
    expect(auditGlyphSymbol('admin-action')).toBe('◉');
  });

  it('falls back to middle-dot for unknown kinds', () => {
    expect(auditGlyphSymbol('mystery')).toBe('·');
    expect(auditGlyphSymbol('')).toBe('·');
  });
});

describe('AE502 - isMirrorViewer', () => {
  it('allows admin role', () => {
    expect(isMirrorViewer('admin')).toBe(true);
  });

  it('allows superadmin role', () => {
    expect(isMirrorViewer('superadmin')).toBe(true);
  });

  it('rejects ordinary user roles', () => {
    expect(isMirrorViewer('user')).toBe(false);
    expect(isMirrorViewer('moderator')).toBe(false);
  });

  it('rejects null + undefined + empty role', () => {
    expect(isMirrorViewer(null)).toBe(false);
    expect(isMirrorViewer(undefined)).toBe(false);
    expect(isMirrorViewer('')).toBe(false);
  });

  it('rejects accidentally non-string inputs by treating them as non-matching', () => {
    expect(isMirrorViewer(0 as unknown as string)).toBe(false);
    expect(isMirrorViewer({ role: 'admin' } as unknown as string)).toBe(false);
  });
});
