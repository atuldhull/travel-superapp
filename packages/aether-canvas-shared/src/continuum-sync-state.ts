/**
 * `continuum-sync-state` — reconcile the live Continuum session (Phase 5
 * slice 4, AE600).
 *
 * Folds the wire messages from `./continuum-sync-protocol` into a local
 * view of the session: which peer devices are connected, what surface
 * each is on, and which surface is "active" elsewhere (so the UI can say
 * "your laptop is on Atlas — continue here?"). Pure + deterministic: a
 * reducer `(state, message, now) → state` plus presence selectors that
 * mirror the live-trip-watch freshness model.
 *
 * Robustness rules baked in:
 *   - **Echo drop**: a message from `selfDeviceId` is ignored (we don't
 *     track ourselves as a peer).
 *   - **Stale/out-of-order drop**: a `state` whose `seq` does not advance
 *     past the peer's last `seq` keeps the newer state (but still
 *     refreshes presence — we did hear from them).
 *   - **Presence by receive-time**: `lastSeenAt` is the `now` we
 *     processed the message, never the sender's clock — so cross-device
 *     skew can't make a peer look fresher/staler than it is.
 *
 * Limitation (documented, not handled here): `bye` drops ALL memory of a
 * peer including its last `seq`. If a device sends `bye` then rejoins with
 * the SAME deviceId on an UNORDERED channel, a pre-`bye` `state` still in
 * flight can be re-applied (it passes the stale check against the
 * post-rejoin `seq:-1`). Mitigation is operational: a rejoining device
 * should use a fresh session/device id (or the transport must be ordered).
 */
import type { ContinuumState } from './continuum-state';
import type { ContinuumDeviceId, ContinuumSyncMessage } from './continuum-sync-protocol';

/** One peer device's last-known view. */
export interface ContinuumPeer {
  readonly deviceId: ContinuumDeviceId;
  /** Last broadcast surface state, or null if we've only seen hello/ping. */
  readonly state: ContinuumState | null;
  /** Highest `state` seq seen from this peer; -1 before any `state`. */
  readonly seq: number;
  /** Receive-time (the `now` passed to the reducer) of the last message. */
  readonly lastSeenAt: number;
}

/** The local view of the whole session. `peers` is keyed by deviceId
 *  (a plain object so the state stays serialisable + deterministic). */
export interface ContinuumSyncState {
  readonly selfDeviceId: ContinuumDeviceId;
  readonly peers: Readonly<Record<ContinuumDeviceId, ContinuumPeer>>;
}

/** Fresh session state for `selfDeviceId` — no peers yet. */
export function initialContinuumSyncState(selfDeviceId: ContinuumDeviceId): ContinuumSyncState {
  return { selfDeviceId, peers: {} };
}

export type ContinuumPeerFreshness = 'live' | 'recent' | 'stale';

/** A peer heard from within this window is "live". */
export const CONTINUUM_PEER_LIVE_MS = 15_000;
/** Beyond this, a peer is "stale" and dropped from the active view. */
export const CONTINUUM_PEER_STALE_MS = 60_000;

/**
 * Apply one decoded message. Pure: returns the SAME reference when the
 * message changes nothing (echo, no-op bye, no-op stale with same
 * receive-time semantics handled by the caller) so consumers can bail
 * cheaply.
 */
export function reduceContinuumSync(
  state: ContinuumSyncState,
  message: ContinuumSyncMessage,
  now: number,
): ContinuumSyncState {
  // Never track ourselves — drop our own echoed frames.
  if (message.deviceId === state.selfDeviceId) return state;

  const existing = state.peers[message.deviceId];

  switch (message.kind) {
    case 'bye': {
      if (existing === undefined) return state; // nothing to remove
      return { ...state, peers: omitPeer(state.peers, message.deviceId) };
    }
    case 'hello':
    case 'ping': {
      const peer: ContinuumPeer =
        existing !== undefined
          ? { ...existing, lastSeenAt: now }
          : { deviceId: message.deviceId, state: null, seq: -1, lastSeenAt: now };
      return { ...state, peers: { ...state.peers, [message.deviceId]: peer } };
    }
    case 'state': {
      // Stale / out-of-order: once a peer HAS a state, seq must strictly
      // advance to replace it (we still refresh presence — we heard from
      // them). Gating on `existing.state !== null` means the FIRST state
      // always lands regardless of its seq, so the `-1` "no state yet"
      // sentinel can never swallow a legitimate first frame (AE601).
      if (existing !== undefined && existing.state !== null && message.seq <= existing.seq) {
        return {
          ...state,
          peers: { ...state.peers, [message.deviceId]: { ...existing, lastSeenAt: now } },
        };
      }
      const peer: ContinuumPeer = {
        deviceId: message.deviceId,
        state: message.state,
        seq: message.seq,
        lastSeenAt: now,
      };
      return { ...state, peers: { ...state.peers, [message.deviceId]: peer } };
    }
  }
}

function omitPeer(
  peers: Readonly<Record<ContinuumDeviceId, ContinuumPeer>>,
  deviceId: ContinuumDeviceId,
): Record<ContinuumDeviceId, ContinuumPeer> {
  const next: Record<ContinuumDeviceId, ContinuumPeer> = {};
  for (const [id, peer] of Object.entries(peers)) {
    if (id !== deviceId) next[id] = peer;
  }
  return next;
}

/** All peers as an array (insertion-order-independent — selectors that
 *  need determinism sort/tie-break explicitly). */
export function continuumPeers(state: ContinuumSyncState): ContinuumPeer[] {
  return Object.values(state.peers);
}

/** Freshness tier for a peer by how long since `lastSeenAt`. */
export function continuumPeerFreshness(
  peer: ContinuumPeer | null | undefined,
  now: number,
  liveMs: number = CONTINUUM_PEER_LIVE_MS,
  staleMs: number = CONTINUUM_PEER_STALE_MS,
): ContinuumPeerFreshness {
  if (peer === null || peer === undefined || !Number.isFinite(peer.lastSeenAt)) return 'stale';
  const delta = now - peer.lastSeenAt;
  if (delta < 0) return 'live'; // future receive-time (clock nudge) — treat as live
  if (delta <= liveMs) return 'live';
  if (delta <= staleMs) return 'recent';
  return 'stale';
}

/** Peers that are not stale (live or recent). */
export function liveContinuumPeers(
  state: ContinuumSyncState,
  now: number,
  liveMs: number = CONTINUUM_PEER_LIVE_MS,
  staleMs: number = CONTINUUM_PEER_STALE_MS,
): ContinuumPeer[] {
  return continuumPeers(state).filter(
    (p) => continuumPeerFreshness(p, now, liveMs, staleMs) !== 'stale',
  );
}

/** Count of non-stale peers. */
export function liveContinuumPeerCount(
  state: ContinuumSyncState,
  now: number,
  liveMs: number = CONTINUUM_PEER_LIVE_MS,
  staleMs: number = CONTINUUM_PEER_STALE_MS,
): number {
  return liveContinuumPeers(state, now, liveMs, staleMs).length;
}

/**
 * The surface another device is currently on — the `ContinuumState` of
 * the most-recently-seen non-stale peer that has broadcast a state. This
 * is what powers "your phone is on Atlas — continue here?". Returns null
 * when no live peer has a state. Ties (equal `lastSeenAt`) break by
 * deviceId ascending so the result is deterministic.
 */
export function activeContinuumState(
  state: ContinuumSyncState,
  now: number,
  liveMs: number = CONTINUUM_PEER_LIVE_MS,
  staleMs: number = CONTINUUM_PEER_STALE_MS,
): ContinuumState | null {
  let best: ContinuumPeer | null = null;
  for (const peer of continuumPeers(state)) {
    if (peer.state === null) continue;
    if (continuumPeerFreshness(peer, now, liveMs, staleMs) === 'stale') continue;
    if (
      best === null ||
      peer.lastSeenAt > best.lastSeenAt ||
      (peer.lastSeenAt === best.lastSeenAt && peer.deviceId < best.deviceId)
    ) {
      best = peer;
    }
  }
  return best === null ? null : best.state;
}
