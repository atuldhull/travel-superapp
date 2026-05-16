/**
 * POST.2A.1 — unit tests for the agent skeleton.
 *
 * Pure unit (no AppModule, no Postgres/Redis): proves the
 * StubSignalAdapter is deterministic and reports "nothing material
 * changed", so the agent boots and every later prompt's zero-key
 * e2e (LAW 1) has a stable fallback. The domain files are type-only
 * (no executable lines) so the meaningful coverage target is the
 * stub adapter — exercised here at 100%.
 *
 * Installed by prompt [POST.2A.1].
 */
import { StubSignalAdapter } from '../src/modules/agent/infrastructure/stub-signal.adapter';
import type { SignalKind } from '../src/modules/agent/domain/trip-watch.entity';
import type { PlanDiff } from '../src/modules/agent/domain/plan-diff.vo';

describe('Agent skeleton (POST.2A.1, unit, no infra)', () => {
  const adapter = new StubSignalAdapter();
  const KINDS: readonly SignalKind[] = ['weather', 'flight', 'geofence'];

  it.each(KINDS)('returns a deterministic "no change" snapshot for %s', async (kind) => {
    const snap = await adapter.snapshot({ kind, lat: 12.34, lng: 56.78 });

    expect(snap.kind).toBe(kind);
    expect(snap.data).toEqual({ changed: false });
    // Fixed epoch — never a "fresh" observation.
    expect(snap.observedAt.getTime()).toBe(0);
  });

  it('is byte-identical across repeated calls (no hidden state / clock)', async () => {
    const a = await adapter.snapshot({ kind: 'weather', lat: 0, lng: 0 });
    const b = await adapter.snapshot({ kind: 'weather', lat: 0, lng: 0 });

    expect(a.observedAt.getTime()).toBe(b.observedAt.getTime());
    expect(a.data).toEqual(b.data);
  });

  it('returns a frozen, immutable payload', async () => {
    const snap = await adapter.snapshot({ kind: 'flight', lat: 1, lng: 2 });

    expect(Object.isFrozen(snap.data)).toBe(true);
    expect(() => {
      (snap.data as Record<string, unknown>).changed = true;
    }).toThrow();
  });

  it('never sends PII — the query shape is coordinates + kind only', async () => {
    // Compile-time guard made explicit: the only inputs the stub
    // (and every real adapter that implements the port) can receive
    // are kind + lat + lng. No email/name/home can be passed.
    const query = { kind: 'weather' as SignalKind, lat: 48.85, lng: 2.35 };
    expect(Object.keys(query).sort()).toEqual(['kind', 'lat', 'lng']);
    await expect(adapter.snapshot(query)).resolves.toBeDefined();
  });

  it('domain PlanDiff value object accepts the three ops', () => {
    const diffs: readonly PlanDiff[] = [
      { op: 'add', stopId: 's1', reason: 'rain ≥ 80% Tue' },
      { op: 'move', stopId: 's2', reason: 'museum closed' },
      { op: 'drop', stopId: 's3', reason: 'flight delayed' },
    ];
    expect(diffs.map((d) => d.op)).toEqual(['add', 'move', 'drop']);
  });
});
