/** AE398 — Lumen surface registered + bound to /aether/memory/:id. */
import { describe, expect, it } from 'vitest';
import { createAetherPhase1Registry } from '../../src/components/aether/phase1/aether-registry';

const surfaces = createAetherPhase1Registry().list();

describe('AE398 — Lumen registry entry', () => {
  const lumen = surfaces.find((s) => s.id === 'lumen');

  it('Lumen surface exists', () => {
    expect(lumen).toBeDefined();
  });

  it('phase: 2 (first Phase 2 surface registered)', () => {
    expect(lumen?.phase).toBe(2);
  });

  it('route is pattern /aether/memory/:id', () => {
    expect(lumen?.route.kind).toBe('pattern');
    expect((lumen?.route as { pathname?: string }).pathname).toBe('/aether/memory/:id');
  });

  it('carries a 5-tuple palette', () => {
    expect(lumen?.palette).toBeDefined();
    expect((lumen?.palette ?? []).length).toBe(5);
  });

  it('mount loader is wired to the Phase 2 scene module', () => {
    expect(typeof lumen?.mount).toBe('function');
  });

  it('does not conflict with any Phase 1 route', () => {
    const ids = surfaces.map((s) => s.id);
    expect(ids).toContain('drift');
    expect(ids).toContain('atlas');
    expect(ids).toContain('compass');
    expect(ids).toContain('pulse');
    expect(ids).toContain('continuum');
    expect(ids).toContain('lumen');
  });
});
