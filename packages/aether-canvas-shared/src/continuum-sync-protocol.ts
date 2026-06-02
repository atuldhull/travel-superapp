/**
 * `continuum-sync-protocol` — the cross-device LIVE-handoff message
 * contract (Phase 5 slice 4, AE599).
 *
 * Phase 1's `continuum-state.ts` ships the one-shot QR / deep-link
 * handoff (a sender encodes a URL, a receiver opens it once). Phase 5's
 * "full handoff" is the LIVE version: two+ devices in a session keep
 * their Aether surface state in sync over a bidirectional channel, so
 * the user's phone shows "your laptop is on Atlas" in real time and a
 * tap continues there.
 *
 * The real channel is WebTransport (a backend b-slice — `WT_FEED_URL` /
 * `WT_PRESENCE_URL`). THIS module is the pure wire contract both ends
 * speak: the message union, a version tag, constructors, and a
 * validating codec. The `state` message carries the SAME `ContinuumState`
 * (pathname + extras) the deep-link handoff uses, so the two paths share
 * one payload shape. The reconciliation (who's live, which surface is
 * active) lives in `./continuum-sync-state`.
 *
 * Pure + framework-free: no socket, no `window`, no React. Sequence
 * numbers (`seq`, per-device monotonic) drive last-writer-wins ordering
 * so the protocol is robust to out-of-order delivery without trusting
 * cross-device clocks.
 */
import type { ContinuumState } from './continuum-state';

/** Bump when the wire shape changes; `decode`/`parse` reject other
 *  versions so a forward-rolled peer never mis-reads an old frame. */
export const CONTINUUM_SYNC_PROTOCOL_VERSION = 1;

/** A device/tab/session identifier (opaque string, caller-assigned). */
export type ContinuumDeviceId = string;

interface ContinuumSyncBase {
  /** Protocol version — always `CONTINUUM_SYNC_PROTOCOL_VERSION`. */
  readonly v: number;
  /** Who sent it. */
  readonly deviceId: ContinuumDeviceId;
  /** Sender's ms-epoch timestamp (informational; presence uses receive
   *  time, ordering uses `seq`, so cross-device clock skew can't corrupt
   *  state). */
  readonly at: number;
}

/** A device joined the session. */
export interface ContinuumHelloMessage extends ContinuumSyncBase {
  readonly kind: 'hello';
}

/** A device left the session. */
export interface ContinuumByeMessage extends ContinuumSyncBase {
  readonly kind: 'bye';
}

/** Heartbeat — refreshes presence without a surface change. */
export interface ContinuumPingMessage extends ContinuumSyncBase {
  readonly kind: 'ping';
}

/** A device broadcasts its current surface state. */
export interface ContinuumStateMessage extends ContinuumSyncBase {
  readonly kind: 'state';
  /** Per-device monotonic sequence — a NON-NEGATIVE safe integer; newer
   *  state has a higher `seq`. The reducer drops any `state` whose `seq`
   *  does not advance past the last seen for that device (stale /
   *  out-of-order / duplicate). */
  readonly seq: number;
  /** The surface state to resume — same shape as the deep-link handoff. */
  readonly state: ContinuumState;
}

export type ContinuumSyncMessage =
  | ContinuumHelloMessage
  | ContinuumByeMessage
  | ContinuumPingMessage
  | ContinuumStateMessage;

/** Construct a `hello`. */
export function helloMessage(deviceId: ContinuumDeviceId, at: number): ContinuumHelloMessage {
  return { v: CONTINUUM_SYNC_PROTOCOL_VERSION, kind: 'hello', deviceId, at };
}

/** Construct a `bye`. */
export function byeMessage(deviceId: ContinuumDeviceId, at: number): ContinuumByeMessage {
  return { v: CONTINUUM_SYNC_PROTOCOL_VERSION, kind: 'bye', deviceId, at };
}

/** Construct a `ping` heartbeat. */
export function pingMessage(deviceId: ContinuumDeviceId, at: number): ContinuumPingMessage {
  return { v: CONTINUUM_SYNC_PROTOCOL_VERSION, kind: 'ping', deviceId, at };
}

/** Construct a `state` broadcast. */
export function stateMessage(
  deviceId: ContinuumDeviceId,
  seq: number,
  at: number,
  state: ContinuumState,
): ContinuumStateMessage {
  return { v: CONTINUUM_SYNC_PROTOCOL_VERSION, kind: 'state', deviceId, seq, at, state };
}

/** Serialize a message for the wire. */
export function encodeContinuumSyncMessage(message: ContinuumSyncMessage): string {
  return JSON.stringify(message);
}

/** Parse + validate a wire string into a message, or `null` if it is not
 *  a well-formed, current-version message (garbage JSON, wrong version,
 *  missing/ill-typed fields, unknown kind). */
export function decodeContinuumSyncMessage(raw: string): ContinuumSyncMessage | null {
  if (typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseContinuumSyncMessage(parsed);
}

/** Validate an already-parsed value into a message, or `null`. Exposed so
 *  a transport that delivers parsed objects can validate without
 *  re-stringifying. */
export function parseContinuumSyncMessage(value: unknown): ContinuumSyncMessage | null {
  if (!isRecord(value)) return null;
  if (value.v !== CONTINUUM_SYNC_PROTOCOL_VERSION) return null;
  if (typeof value.deviceId !== 'string' || value.deviceId === '') return null;
  if (typeof value.at !== 'number' || !Number.isFinite(value.at)) return null;

  switch (value.kind) {
    case 'hello':
      return helloMessage(value.deviceId, value.at);
    case 'bye':
      return byeMessage(value.deviceId, value.at);
    case 'ping':
      return pingMessage(value.deviceId, value.at);
    case 'state': {
      // seq must be a non-negative SAFE integer: a fractional seq breaks
      // the integer monotonic contract, and a value > MAX_SAFE_INTEGER
      // loses precision through JSON so two distinct seqs collapse and a
      // genuinely-newer state is wrongly dropped as stale (AE601).
      if (typeof value.seq !== 'number' || !Number.isSafeInteger(value.seq) || value.seq < 0) {
        return null;
      }
      const state = parseContinuumStatePayload(value.state);
      if (state === null) return null;
      return stateMessage(value.deviceId, value.seq, value.at, state);
    }
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the `state` payload as a `ContinuumState` ({ pathname,
 *  extras? }). Extras, when present, must be a flat string→string map. */
function parseContinuumStatePayload(value: unknown): ContinuumState | null {
  if (!isRecord(value)) return null;
  // pathname must honour the shared ContinuumState invariant: a single
  // leading '/', no scheme, no protocol-relative '//host' — so a hostile
  // peer can't inject a `javascript:` / `//evil.com` value into the
  // surface that powers the "continue here?" navigation (AE601).
  if (
    typeof value.pathname !== 'string' ||
    !value.pathname.startsWith('/') ||
    value.pathname.startsWith('//')
  ) {
    return null;
  }
  if (value.extras === undefined) {
    return { pathname: value.pathname };
  }
  if (!isRecord(value.extras)) return null;
  const extras: Record<string, string> = {};
  for (const [k, v] of Object.entries(value.extras)) {
    // Reject prototype-pollution-shaped keys outright — they are never
    // legitimate surface extras, and the silent-loss alternative breaks
    // the lossless round-trip contract (AE601).
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return null;
    if (typeof v !== 'string') return null;
    extras[k] = v;
  }
  return { pathname: value.pathname, extras };
}
