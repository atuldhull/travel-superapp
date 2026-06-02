/**
 * AE599 — behavioural spec for `continuum-sync-protocol`.
 *
 * Pins the constructors, the encode/decode round-trip for every message
 * kind, the validating decode (garbage / wrong version / ill-typed /
 * unknown kind), and the `state` payload validation.
 */
import {
  CONTINUUM_SYNC_PROTOCOL_VERSION as V,
  byeMessage,
  decodeContinuumSyncMessage as decode,
  encodeContinuumSyncMessage as encode,
  helloMessage,
  parseContinuumSyncMessage as parse,
  pingMessage,
  stateMessage,
  type ContinuumSyncMessage,
} from '../src';

describe('AE599 — constructors', () => {
  it('stamp the version + kind + fields', () => {
    expect(helloMessage('A', 100)).toEqual({ v: V, kind: 'hello', deviceId: 'A', at: 100 });
    expect(byeMessage('A', 100)).toEqual({ v: V, kind: 'bye', deviceId: 'A', at: 100 });
    expect(pingMessage('A', 100)).toEqual({ v: V, kind: 'ping', deviceId: 'A', at: 100 });
    expect(stateMessage('A', 3, 100, { pathname: '/aether/atlas' })).toEqual({
      v: V,
      kind: 'state',
      deviceId: 'A',
      seq: 3,
      at: 100,
      state: { pathname: '/aether/atlas' },
    });
  });
});

describe('AE599 — encode/decode round-trip', () => {
  const messages: ContinuumSyncMessage[] = [
    helloMessage('A', 1),
    byeMessage('A', 2),
    pingMessage('A', 3),
    stateMessage('A', 7, 4, { pathname: '/aether/atlas', extras: { focus: 'leh' } }),
  ];
  it('round-trips every kind', () => {
    for (const m of messages) {
      expect(decode(encode(m))).toEqual(m);
    }
  });
  it('preserves the state payload incl. extras', () => {
    const m = stateMessage('A', 1, 1, { pathname: '/aether/lumen', extras: { a: '1', b: 'two' } });
    expect(decode(encode(m))).toEqual(m);
  });
});

describe('AE599 — decode rejects malformed input', () => {
  it('rejects non-JSON + non-string', () => {
    expect(decode('{not json')).toBeNull();
    expect(decode('')).toBeNull();
  });
  it('rejects a wrong protocol version', () => {
    expect(decode(JSON.stringify({ v: 999, kind: 'hello', deviceId: 'A', at: 1 }))).toBeNull();
  });
  it('rejects missing / empty deviceId + non-numeric at', () => {
    expect(decode(JSON.stringify({ v: V, kind: 'hello', at: 1 }))).toBeNull();
    expect(decode(JSON.stringify({ v: V, kind: 'hello', deviceId: '', at: 1 }))).toBeNull();
    expect(decode(JSON.stringify({ v: V, kind: 'hello', deviceId: 'A', at: 'x' }))).toBeNull();
  });
  it('rejects an unknown kind', () => {
    expect(decode(JSON.stringify({ v: V, kind: 'nope', deviceId: 'A', at: 1 }))).toBeNull();
  });
  it('rejects a state message missing seq or with a bad payload', () => {
    expect(
      decode(
        JSON.stringify({ v: V, kind: 'state', deviceId: 'A', at: 1, state: { pathname: '/x' } }),
      ),
    ).toBeNull(); // no seq
    expect(
      decode(JSON.stringify({ v: V, kind: 'state', deviceId: 'A', at: 1, seq: 1, state: {} })),
    ).toBeNull(); // no pathname
    expect(
      decode(
        JSON.stringify({
          v: V,
          kind: 'state',
          deviceId: 'A',
          at: 1,
          seq: 1,
          state: { pathname: '/x', extras: { a: 5 } },
        }),
      ),
    ).toBeNull(); // non-string extras value
  });
});

describe('AE599 — parse (object-level) guards non-finite + non-objects', () => {
  it('rejects non-object values', () => {
    expect(parse(null)).toBeNull();
    expect(parse([])).toBeNull();
    expect(parse('hello')).toBeNull();
    expect(parse(42)).toBeNull();
  });
  it('rejects non-finite at / seq (which JSON would have coerced to null)', () => {
    expect(parse({ v: V, kind: 'hello', deviceId: 'A', at: Number.NaN })).toBeNull();
    expect(parse({ v: V, kind: 'hello', deviceId: 'A', at: Number.POSITIVE_INFINITY })).toBeNull();
    expect(
      parse({
        v: V,
        kind: 'state',
        deviceId: 'A',
        at: 1,
        seq: Number.NaN,
        state: { pathname: '/x' },
      }),
    ).toBeNull();
  });
  it('accepts a valid object', () => {
    expect(parse({ v: V, kind: 'ping', deviceId: 'A', at: 1 })).toEqual(pingMessage('A', 1));
  });
});

describe('AE601 — hardening: seq / pathname / extras guards', () => {
  const stateBase = { v: V, kind: 'state', deviceId: 'A', at: 1, state: { pathname: '/x' } };

  it('rejects a non-integer, negative, or unsafe-magnitude seq', () => {
    expect(parse({ ...stateBase, seq: 1.5 })).toBeNull();
    expect(parse({ ...stateBase, seq: -1 })).toBeNull();
    expect(parse({ ...stateBase, seq: 9007199254740993 })).toBeNull(); // > MAX_SAFE_INTEGER
    expect(parse({ ...stateBase, seq: 0 })).not.toBeNull(); // 0 is valid
  });

  it('rejects a pathname that is not a single-leading-slash path', () => {
    const mk = (pathname: string): unknown =>
      decode(
        JSON.stringify({ v: V, kind: 'state', deviceId: 'A', at: 1, seq: 1, state: { pathname } }),
      );
    expect(mk('javascript:alert(1)')).toBeNull();
    expect(mk('//evil.com')).toBeNull(); // protocol-relative
    expect(mk('')).toBeNull();
    expect(mk('/aether/atlas')).not.toBeNull();
  });

  it('rejects a non-object extras (array / null / primitive)', () => {
    const mk = (extras: unknown): unknown =>
      parse({
        v: V,
        kind: 'state',
        deviceId: 'A',
        at: 1,
        seq: 1,
        state: { pathname: '/x', extras },
      });
    expect(mk([])).toBeNull();
    expect(mk(null)).toBeNull();
    expect(mk('x')).toBeNull();
    expect(mk(5)).toBeNull();
  });

  it('rejects prototype-pollution-shaped extras keys (own __proto__ from the wire)', () => {
    // JSON.parse makes "__proto__" an OWN key, so a hand-crafted wire
    // frame can carry it; the codec must reject, not silently drop.
    const raw = `{"v":${V},"kind":"state","deviceId":"A","at":1,"seq":1,"state":{"pathname":"/x","extras":{"__proto__":"evil"}}}`;
    expect(decode(raw)).toBeNull();
  });
});
