/** AE374 — route matcher specs. */
import {
  matchSurfaceRoute,
  overlaySurfaces,
  routeToSurface,
} from '../../src/surface/route-to-surface';
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
const compass: Surface = {
  id: 'compass',
  phase: 1,
  route: { kind: 'predicate', match: (p) => p.startsWith('/aether/atlas') },
};
const pulse: Surface = {
  id: 'pulse',
  phase: 1,
  route: { kind: 'overlay' },
};
const continuum: Surface = {
  id: 'continuum',
  phase: 1,
  route: { kind: 'overlay' },
};

const ALL = [drift, atlas, compass, pulse, continuum];

describe('matchSurfaceRoute — literal', () => {
  it('exact match', () => {
    expect(matchSurfaceRoute(drift.route, '/aether')).toBe(true);
  });

  it('mismatch', () => {
    expect(matchSurfaceRoute(drift.route, '/aether/')).toBe(false);
    expect(matchSurfaceRoute(drift.route, '/aether/drift')).toBe(false);
    expect(matchSurfaceRoute(drift.route, '/')).toBe(false);
  });
});

describe('matchSurfaceRoute — pattern', () => {
  it(':id consumes one segment', () => {
    expect(matchSurfaceRoute(atlas.route, '/aether/journey/abc123')).toBe(true);
    expect(matchSurfaceRoute(atlas.route, '/aether/journey/abc-def-ghi')).toBe(true);
  });

  it('extra trailing segment is not a match', () => {
    expect(matchSurfaceRoute(atlas.route, '/aether/journey/abc/extra')).toBe(false);
  });

  it('missing segment is not a match', () => {
    expect(matchSurfaceRoute(atlas.route, '/aether/journey/')).toBe(false);
    expect(matchSurfaceRoute(atlas.route, '/aether/journey')).toBe(false);
  });

  it('trailing slash is tolerated symmetrically', () => {
    expect(matchSurfaceRoute(atlas.route, '/aether/journey/abc/')).toBe(true);
  });
});

describe('matchSurfaceRoute — predicate', () => {
  it('delegates to caller', () => {
    expect(matchSurfaceRoute(compass.route, '/aether/atlas')).toBe(true);
    expect(matchSurfaceRoute(compass.route, '/aether/atlas?focus=leh')).toBe(true);
    expect(matchSurfaceRoute(compass.route, '/aether/journey/1')).toBe(false);
  });
});

describe('matchSurfaceRoute — overlay', () => {
  it('never matches a route', () => {
    expect(matchSurfaceRoute(pulse.route, '/aether')).toBe(false);
    expect(matchSurfaceRoute(pulse.route, '/anything')).toBe(false);
  });
});

describe('routeToSurface', () => {
  it('returns first matching route-bound surface', () => {
    expect(routeToSurface('/aether', ALL)?.id).toBe('drift');
    expect(routeToSurface('/aether/journey/xyz', ALL)?.id).toBe('atlas');
    expect(routeToSurface('/aether/atlas', ALL)?.id).toBe('compass');
  });

  it('returns undefined when no route-bound surface matches', () => {
    expect(routeToSurface('/some/other/path', ALL)).toBeUndefined();
  });

  it('never returns an overlay surface', () => {
    // Pulse + Continuum have overlay routes — they should never be picked
    // by routeToSurface even if no other surface matches.
    expect(routeToSurface('/anything', [pulse, continuum])).toBeUndefined();
  });

  it('registration order picks the first match', () => {
    const a: Surface = { id: 'drift', phase: 1, route: { kind: 'literal', pathname: '/x' } };
    const b: Surface = {
      id: 'atlas',
      phase: 1,
      route: { kind: 'predicate', match: (p) => p === '/x' },
    };
    expect(routeToSurface('/x', [a, b])?.id).toBe('drift');
    expect(routeToSurface('/x', [b, a])?.id).toBe('atlas');
  });
});

describe('overlaySurfaces', () => {
  it('returns only overlay-kind surfaces in registration order', () => {
    const overlays = overlaySurfaces(ALL);
    expect(overlays.map((s) => s.id)).toEqual(['pulse', 'continuum']);
  });

  it('empty list when nothing is overlay', () => {
    expect(overlaySurfaces([drift, atlas])).toEqual([]);
  });
});
