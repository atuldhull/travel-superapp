/** AE384 — <SurfacePaletteOverride/> + useSurfacePalette precedence. */
import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SurfaceManagerProvider } from '../../src/surface/manager';
import {
  SurfacePaletteOverride,
  SurfacePaletteVars,
  useSurfacePalette,
} from '../../src/surface/palette-hooks';
import { DEFAULT_SURFACE_PALETTE, type SurfacePalette } from '../../src/surface/palette';
import { createSurfaceRegistry } from '../../src/surface/registry';
import type { Surface } from '../../src/surface/types';

const REGISTERED: SurfacePalette = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF'];
const OVERRIDE: SurfacePalette = ['#111111', '#EEEEEE', '#AABBCC', '#DDDDDD', '#222222'];

const driftSurface: Surface = {
  id: 'drift',
  phase: 1,
  route: { kind: 'literal', pathname: '/aether/drift' },
  palette: REGISTERED,
};

function wrap(
  pathname: string,
  override: SurfacePalette | null,
): React.FC<{ children: ReactNode }> {
  const registry = createSurfaceRegistry([driftSurface]);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname={pathname}>
        <SurfacePaletteOverride palette={override}>{children}</SurfacePaletteOverride>
      </SurfaceManagerProvider>
    );
  };
}

describe('useSurfacePalette + <SurfacePaletteOverride>', () => {
  it('no override → falls through to the registered surface palette (AE381)', () => {
    const { result } = renderHook(() => useSurfacePalette(), {
      wrapper: wrap('/aether/drift', null),
    });
    expect(result.current).toBe(REGISTERED);
  });

  it('non-null override wins over registered palette', () => {
    const { result } = renderHook(() => useSurfacePalette(), {
      wrapper: wrap('/aether/drift', OVERRIDE),
    });
    expect(result.current).toBe(OVERRIDE);
  });

  it('override null + no surface match → default palette', () => {
    const { result } = renderHook(() => useSurfacePalette(), {
      wrapper: wrap('/nowhere', null),
    });
    expect(result.current).toBe(DEFAULT_SURFACE_PALETTE);
  });

  it('override wins even when no surface matches', () => {
    const { result } = renderHook(() => useSurfacePalette(), {
      wrapper: wrap('/nowhere', OVERRIDE),
    });
    expect(result.current).toBe(OVERRIDE);
  });
});

describe('SurfacePaletteVars + override', () => {
  it('writes the override palette to CSS vars when set', () => {
    const Wrap = wrap('/aether/drift', OVERRIDE);
    render(
      <Wrap>
        <SurfacePaletteVars />
      </Wrap>,
    );
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--aether-palette-0')).toBe(OVERRIDE[0]);
    expect(root.style.getPropertyValue('--aether-palette-accent')).toBe(OVERRIDE[2]);
  });
});
