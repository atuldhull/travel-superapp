/**
 * AE600 — behavioural spec for `continuum-sync-state`.
 *
 * Pins the reducer (hello/ping/state/bye, echo drop, stale/out-of-order
 * drop, receive-time presence) + the presence selectors (freshness tiers,
 * live peers, the active-surface selector incl. tie-break).
 */
import {
  activeContinuumState,
  byeMessage,
  continuumPeerFreshness,
  continuumPeers,
  helloMessage,
  initialContinuumSyncState,
  liveContinuumPeerCount,
  pingMessage,
  reduceContinuumSync,
  stateMessage,
  type ContinuumPeer,
  type ContinuumSyncState,
} from '../src';

const SELF = 'self';

describe('AE600 — reduceContinuumSync', () => {
  it('starts with no peers', () => {
    expect(initialContinuumSyncState(SELF)).toEqual({ selfDeviceId: SELF, peers: {} });
  });

  it('hello adds a peer with no state yet', () => {
    const s = reduceContinuumSync(initialContinuumSyncState(SELF), helloMessage('A', 1), 1000);
    expect(s.peers['A']).toEqual({ deviceId: 'A', state: null, seq: -1, lastSeenAt: 1000 });
  });

  it('ignores our own echoed frames (same reference)', () => {
    const s = reduceContinuumSync(initialContinuumSyncState(SELF), helloMessage('A', 1), 1000);
    expect(reduceContinuumSync(s, helloMessage(SELF, 2), 2000)).toBe(s);
  });

  it('state sets the peer surface + seq', () => {
    let s = reduceContinuumSync(initialContinuumSyncState(SELF), helloMessage('A', 1), 1000);
    s = reduceContinuumSync(s, stateMessage('A', 0, 2, { pathname: '/aether/atlas' }), 1100);
    expect(s.peers['A']?.state).toEqual({ pathname: '/aether/atlas' });
    expect(s.peers['A']?.seq).toBe(0);
    expect(s.peers['A']?.lastSeenAt).toBe(1100);
  });

  it('drops a stale / out-of-order state but still refreshes presence', () => {
    let s = reduceContinuumSync(
      initialContinuumSyncState(SELF),
      stateMessage('A', 2, 1, { pathname: '/two' }),
      1000,
    );
    s = reduceContinuumSync(s, stateMessage('A', 1, 1, { pathname: '/one' }), 1500); // seq 1 <= 2
    expect(s.peers['A']?.state).toEqual({ pathname: '/two' }); // unchanged
    expect(s.peers['A']?.seq).toBe(2);
    expect(s.peers['A']?.lastSeenAt).toBe(1500); // presence refreshed
  });

  it('applies a newer state (seq advances)', () => {
    let s = reduceContinuumSync(
      initialContinuumSyncState(SELF),
      stateMessage('A', 2, 1, { pathname: '/two' }),
      1000,
    );
    s = reduceContinuumSync(s, stateMessage('A', 3, 1, { pathname: '/three' }), 1100);
    expect(s.peers['A']?.state).toEqual({ pathname: '/three' });
    expect(s.peers['A']?.seq).toBe(3);
  });

  it('ping refreshes presence + creates an unknown peer', () => {
    let s = reduceContinuumSync(
      initialContinuumSyncState(SELF),
      stateMessage('A', 0, 1, { pathname: '/x' }),
      1000,
    );
    s = reduceContinuumSync(s, pingMessage('A', 2), 2000);
    expect(s.peers['A']?.lastSeenAt).toBe(2000);
    expect(s.peers['A']?.state).toEqual({ pathname: '/x' }); // ping doesn't clear state
    const fresh = reduceContinuumSync(initialContinuumSyncState(SELF), pingMessage('B', 1), 1000);
    expect(fresh.peers['B']).toEqual({ deviceId: 'B', state: null, seq: -1, lastSeenAt: 1000 });
  });

  it('bye removes a peer; an unknown bye is a no-op (same reference)', () => {
    const s = reduceContinuumSync(initialContinuumSyncState(SELF), helloMessage('A', 1), 1000);
    expect(reduceContinuumSync(s, byeMessage('A', 2), 2000).peers['A']).toBeUndefined();
    expect(reduceContinuumSync(s, byeMessage('ghost', 2), 2000)).toBe(s);
  });
});

describe('AE600 — presence selectors', () => {
  const peer = (over: Partial<ContinuumPeer> = {}): ContinuumPeer => ({
    deviceId: 'A',
    state: { pathname: '/x' },
    seq: 0,
    lastSeenAt: 1000,
    ...over,
  });

  it('continuumPeerFreshness tiers by age', () => {
    expect(continuumPeerFreshness(peer({ lastSeenAt: 1000 }), 1000)).toBe('live'); // delta 0
    expect(continuumPeerFreshness(peer({ lastSeenAt: 1000 }), 1000 + 10_000)).toBe('live');
    expect(continuumPeerFreshness(peer({ lastSeenAt: 1000 }), 1000 + 30_000)).toBe('recent');
    expect(continuumPeerFreshness(peer({ lastSeenAt: 1000 }), 1000 + 70_000)).toBe('stale');
  });
  it('treats null + a future receive-time defensively', () => {
    expect(continuumPeerFreshness(null, 1000)).toBe('stale');
    expect(continuumPeerFreshness(peer({ lastSeenAt: 2000 }), 1000)).toBe('live'); // now < lastSeenAt
  });

  it('liveContinuumPeerCount excludes stale peers', () => {
    let s = reduceContinuumSync(
      initialContinuumSyncState(SELF),
      stateMessage('A', 0, 1, { pathname: '/a' }),
      1000,
    );
    s = reduceContinuumSync(s, stateMessage('B', 0, 1, { pathname: '/b' }), 100_000);
    // at now=100_000: A (seen 1000) is stale, B (seen 100_000) is live.
    expect(liveContinuumPeerCount(s, 100_000)).toBe(1);
    expect(continuumPeers(s)).toHaveLength(2);
  });

  it('activeContinuumState picks the most-recently-seen live peer with a state', () => {
    let s = reduceContinuumSync(
      initialContinuumSyncState(SELF),
      stateMessage('A', 0, 1, { pathname: '/aether/atlas' }),
      1000,
    );
    s = reduceContinuumSync(s, stateMessage('B', 0, 1, { pathname: '/aether/lumen' }), 2000);
    expect(activeContinuumState(s, 2000)).toEqual({ pathname: '/aether/lumen' }); // B newer
    expect(activeContinuumState(s, 200_000)).toBeNull(); // both stale
  });

  it('ignores peers with no state + breaks ties by deviceId', () => {
    let s = reduceContinuumSync(initialContinuumSyncState(SELF), helloMessage('Z', 1), 1000); // no state
    s = reduceContinuumSync(s, stateMessage('B', 0, 1, { pathname: '/b' }), 1000);
    s = reduceContinuumSync(s, stateMessage('A', 0, 1, { pathname: '/a' }), 1000); // tie w/ B at 1000
    expect(activeContinuumState(s, 1000)).toEqual({ pathname: '/a' }); // A < B
  });
});

describe('AE601 — hardening: boundaries, equal-seq, non-finite, gate, purity', () => {
  it('pins the freshness tier boundaries (inclusive cutoffs)', () => {
    const p: ContinuumPeer = { deviceId: 'A', state: { pathname: '/x' }, seq: 0, lastSeenAt: 1000 };
    expect(continuumPeerFreshness(p, 1000 + 15_000)).toBe('live'); // == liveMs
    expect(continuumPeerFreshness(p, 1000 + 15_001)).toBe('recent');
    expect(continuumPeerFreshness(p, 1000 + 60_000)).toBe('recent'); // == staleMs
    expect(continuumPeerFreshness(p, 1000 + 60_001)).toBe('stale');
  });

  it('treats a non-finite lastSeenAt as stale + never lets it dominate the active surface', () => {
    const nan: ContinuumPeer = {
      deviceId: 'A',
      state: { pathname: '/x' },
      seq: 0,
      lastSeenAt: Number.NaN,
    };
    const inf: ContinuumPeer = {
      deviceId: 'A',
      state: { pathname: '/x' },
      seq: 0,
      lastSeenAt: Number.POSITIVE_INFINITY,
    };
    expect(continuumPeerFreshness(nan, 1000)).toBe('stale');
    expect(continuumPeerFreshness(inf, 1000)).toBe('stale');
    // a bogus +Infinity peer must NOT win activeContinuumState via Infinity > x.
    const bogus: ContinuumSyncState = {
      selfDeviceId: SELF,
      peers: {
        bad: {
          deviceId: 'bad',
          state: { pathname: '/bad' },
          seq: 0,
          lastSeenAt: Number.POSITIVE_INFINITY,
        },
        good: { deviceId: 'good', state: { pathname: '/good' }, seq: 0, lastSeenAt: 1000 },
      },
    };
    expect(activeContinuumState(bogus, 1000)).toEqual({ pathname: '/good' });
  });

  it('drops an EQUAL-seq duplicate state (keeps the first payload, refreshes presence)', () => {
    let s = reduceContinuumSync(
      initialContinuumSyncState(SELF),
      stateMessage('A', 2, 10, { pathname: '/first' }),
      1000,
    );
    s = reduceContinuumSync(s, stateMessage('A', 2, 20, { pathname: '/dup' }), 1500); // same seq 2
    expect(s.peers['A']?.state).toEqual({ pathname: '/first' });
    expect(s.peers['A']?.seq).toBe(2);
    expect(s.peers['A']?.lastSeenAt).toBe(1500); // presence still refreshed
  });

  it('lands a FIRST state even with the -1 sentinel seq (the state!==null gate, not the <= compare)', () => {
    let s = reduceContinuumSync(initialContinuumSyncState(SELF), helloMessage('A', 1), 1000);
    // seq -1 == the sentinel; without the gate this would be dropped.
    s = reduceContinuumSync(s, stateMessage('A', -1, 2, { pathname: '/x' }), 1100);
    expect(s.peers['A']?.state).toEqual({ pathname: '/x' });
    expect(s.peers['A']?.seq).toBe(-1);
  });

  it('does not mutate the input state (purity)', () => {
    const prev = reduceContinuumSync(
      initialContinuumSyncState(SELF),
      stateMessage('A', 0, 1, { pathname: '/a' }),
      1000,
    );
    Object.freeze(prev);
    Object.freeze(prev.peers);
    Object.freeze(prev.peers['A']);
    const next = reduceContinuumSync(prev, stateMessage('B', 0, 1, { pathname: '/b' }), 2000);
    expect(next).not.toBe(prev);
    expect(prev.peers['B']).toBeUndefined(); // prior snapshot untouched
    expect(Object.keys(next.peers).sort()).toEqual(['A', 'B']);
  });
});
