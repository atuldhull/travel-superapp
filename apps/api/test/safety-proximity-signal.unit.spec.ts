/**
 * Pure unit tests for `SafetyProximitySignalAdapter` (Phase 6, I4).
 * No DB, no network — proves the qualify logic deterministically.
 */
import { SafetyProximitySignalAdapter } from '../src/modules/agent/infrastructure/safety-proximity-signal.adapter';
import type { NearbyScamReport } from '../src/modules/agent/application/ports/signal-source.port';

function report(over: Partial<NearbyScamReport> = {}): NearbyScamReport {
  return { distanceKm: 1, verified: true, observedDaysAgo: 1, ...over };
}

describe('SafetyProximitySignalAdapter (unit)', () => {
  const adapter = new SafetyProximitySignalAdapter();
  const baseQuery = { kind: 'safety_proximity' as const, lat: 0, lng: 0 };

  it('returns kind="safety_proximity" and an observedAt timestamp', async () => {
    const snap = await adapter.snapshot(baseQuery);
    expect(snap.kind).toBe('safety_proximity');
    expect(snap.observedAt).toBeInstanceOf(Date);
  });

  it('changed=false when nearbyScamReports is absent', async () => {
    const snap = await adapter.snapshot(baseQuery);
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['reason']).toBe('no-reports');
  });

  it('changed=false for an empty reports array', async () => {
    const snap = await adapter.snapshot({ ...baseQuery, nearbyScamReports: [] });
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['reason']).toBe('no-reports');
  });

  it('changed=false when the only nearby report is unverified', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      nearbyScamReports: [report({ verified: false })],
    });
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['qualifyingCount']).toBe(0);
  });

  it('changed=false when a verified report is beyond the 5km radius', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      nearbyScamReports: [report({ distanceKm: 9 })],
    });
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['nearestKm']).toBe(9);
  });

  it('changed=false when a verified, close report is stale (>14 days)', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      nearbyScamReports: [report({ observedDaysAgo: 30 })],
    });
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['qualifyingCount']).toBe(0);
  });

  it('changed=true for a verified report within 5km observed within 14 days', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      nearbyScamReports: [report({ distanceKm: 2, observedDaysAgo: 3 })],
    });
    expect(snap.data['changed']).toBe(true);
    expect(snap.data['qualifyingCount']).toBe(1);
    expect(snap.data['nearestKm']).toBe(2);
    expect(snap.data['radiusKm']).toBe(5);
    expect(snap.data['windowDays']).toBe(14);
  });

  it('changed=true on the radius + recency boundary (exactly 5km, 14 days)', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      nearbyScamReports: [report({ distanceKm: 5, observedDaysAgo: 14 })],
    });
    expect(snap.data['changed']).toBe(true);
  });

  it('reports the nearest qualifying distance when several qualify', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      nearbyScamReports: [
        report({ distanceKm: 4 }),
        report({ distanceKm: 1.2 }),
        report({ distanceKm: 3 }),
      ],
    });
    expect(snap.data['changed']).toBe(true);
    expect(snap.data['qualifyingCount']).toBe(3);
    expect(snap.data['nearestKm']).toBe(1.2);
  });

  it('treats a negative distance as not-qualifying and never throws', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      nearbyScamReports: [report({ distanceKm: -1 })],
    });
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['qualifyingCount']).toBe(0);
  });

  it('counts only the qualifying subset, ignoring far / unverified neighbours', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      nearbyScamReports: [
        report({ distanceKm: 1 }), // qualifies
        report({ verified: false, distanceKm: 1 }), // unverified
        report({ distanceKm: 40 }), // too far
        report({ observedDaysAgo: 90 }), // stale
      ],
    });
    expect(snap.data['changed']).toBe(true);
    expect(snap.data['reportCount']).toBe(4);
    expect(snap.data['qualifyingCount']).toBe(1);
  });
});
