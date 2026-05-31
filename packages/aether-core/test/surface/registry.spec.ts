/** AE374 — SurfaceRegistry specs. */
import { SurfaceRegistry, createSurfaceRegistry } from '../../src/surface/registry';
import type { Surface } from '../../src/surface/types';

const drift: Surface = {
  id: 'drift',
  phase: 1,
  route: { kind: 'literal', pathname: '/aether' },
};
const atlas: Surface = {
  id: 'atlas',
  phase: 1,
  route: { kind: 'pattern', pathname: '/aether/journey/:id' },
};
const pulse: Surface = {
  id: 'pulse',
  phase: 1,
  route: { kind: 'overlay' },
};

describe('SurfaceRegistry', () => {
  it('starts empty', () => {
    const r = new SurfaceRegistry();
    expect(r.list()).toEqual([]);
    expect(r.size).toBe(0);
  });

  it('register() appends in order + returns this', () => {
    const r = new SurfaceRegistry();
    expect(r.register(drift)).toBe(r);
    r.register(atlas);
    r.register(pulse);
    expect(r.list().map((s) => s.id)).toEqual(['drift', 'atlas', 'pulse']);
    expect(r.size).toBe(3);
  });

  it('list() returns a frozen snapshot', () => {
    const r = new SurfaceRegistry();
    r.register(drift);
    const snap = r.list();
    expect(Object.isFrozen(snap)).toBe(true);
    // Frozen snapshot doesn't mutate.
    expect(() => {
      // @ts-expect-error mutation should be prevented at runtime
      snap.push(atlas);
    }).toThrow();
  });

  it('list() snapshot does not share identity with internal state', () => {
    const r = new SurfaceRegistry();
    r.register(drift);
    const a = r.list();
    r.register(atlas);
    const b = r.list();
    expect(a).not.toBe(b);
    expect(a.length).toBe(1);
    expect(b.length).toBe(2);
  });

  it('duplicate id throws', () => {
    const r = new SurfaceRegistry();
    r.register(drift);
    expect(() => r.register(drift)).toThrow(/already registered/);
    expect(() =>
      r.register({
        id: 'drift',
        phase: 1,
        route: { kind: 'overlay' },
      }),
    ).toThrow(/already registered/);
  });

  it('findById returns the registered surface or undefined', () => {
    const r = new SurfaceRegistry();
    r.register(drift);
    r.register(atlas);
    expect(r.findById('drift')).toBe(drift);
    expect(r.findById('atlas')).toBe(atlas);
    expect(r.findById('lumen')).toBeUndefined();
  });
});

describe('createSurfaceRegistry', () => {
  it('seeds an empty registry by default', () => {
    expect(createSurfaceRegistry().size).toBe(0);
  });

  it('seeds in order from the provided list', () => {
    const r = createSurfaceRegistry([drift, atlas, pulse]);
    expect(r.list().map((s) => s.id)).toEqual(['drift', 'atlas', 'pulse']);
  });

  it('duplicates in the seed throw at boot', () => {
    expect(() => createSurfaceRegistry([drift, drift])).toThrow(/already registered/);
  });
});
