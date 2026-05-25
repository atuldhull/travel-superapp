/**
 * Pure unit tests for `DeadlineSignalAdapter` (Phase 3, G5).
 * No DB, no network — proves the bucket logic deterministically.
 */
import { SYSTEM_CLOCK } from '@app/clock';
import { DeadlineSignalAdapter } from '../src/modules/agent/infrastructure/deadline-signal.adapter';

function daysFromNow(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

describe('DeadlineSignalAdapter (unit)', () => {
  const adapter = new DeadlineSignalAdapter(SYSTEM_CLOCK);
  const baseQuery = { kind: 'deadline' as const, lat: 0, lng: 0 };

  it('returns kind="deadline" and an observedAt timestamp', async () => {
    const snap = await adapter.snapshot(baseQuery);
    expect(snap.kind).toBe('deadline');
    expect(snap.observedAt).toBeInstanceOf(Date);
  });

  it('changed=false when tripStartsOnIso is absent', async () => {
    const snap = await adapter.snapshot(baseQuery);
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['reason']).toBe('no-startsOn');
  });

  it('changed=false for an unparseable ISO', async () => {
    const snap = await adapter.snapshot({ ...baseQuery, tripStartsOnIso: 'not-a-date' });
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['reason']).toBe('invalid-iso');
  });

  it('changed=false when the trip is in the past', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      tripStartsOnIso: daysFromNow(-3),
    });
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['reason']).toBe('past');
    expect(snap.data['daysUntilStart']).toBe(-3);
  });

  it('changed=false when trip starts beyond the 7-day reminder window', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      tripStartsOnIso: daysFromNow(30),
    });
    expect(snap.data['changed']).toBe(false);
    expect(snap.data['daysUntilStart']).toBe(30);
    expect(snap.data['windowDays']).toBe(7);
  });

  it('changed=true when trip starts within the window (3 days)', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      tripStartsOnIso: daysFromNow(3),
    });
    expect(snap.data['changed']).toBe(true);
    expect(snap.data['daysUntilStart']).toBe(3);
    expect(snap.data['windowDays']).toBe(7);
  });

  it('changed=true on the window boundary (exactly 7 days out)', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      tripStartsOnIso: daysFromNow(7),
    });
    expect(snap.data['changed']).toBe(true);
    expect(snap.data['daysUntilStart']).toBe(7);
  });

  it('changed=true when the trip starts today (daysUntilStart=0)', async () => {
    const snap = await adapter.snapshot({
      ...baseQuery,
      tripStartsOnIso: daysFromNow(0),
    });
    expect(snap.data['changed']).toBe(true);
    expect(snap.data['daysUntilStart']).toBe(0);
  });
});
