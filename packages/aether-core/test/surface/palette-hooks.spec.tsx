/** AE381 — palette hook + SurfacePaletteVars specs. */
import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SurfaceManagerProvider } from '../../src/surface/manager';
import { SurfacePaletteVars } from '../../src/surface/palette-hooks';
import { DEFAULT_SURFACE_PALETTE, slotsFor, type SurfacePalette } from '../../src/surface/palette';
import { createSurfaceRegistry } from '../../src/surface/registry';
import { useSurfacePalette, useSurfacePaletteSlots } from '../../src/surface/palette-hooks';
import type { Surface } from '../../src/surface/types';

const CUSTOM: SurfacePalette = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF'];

const driftWithPalette: Surface = {
  id: 'drift',
  phase: 1,
  route: { kind: 'literal', pathname: '/aether/drift' },
  palette: CUSTOM,
};

const atlasNoPalette: Surface = {
  id: 'atlas',
  phase: 1,
  route: { kind: 'pattern', pathname: '/aether/journey/:id' },
};

function wrap(
  pathname: string,
  surfaces: ReadonlyArray<Surface>,
): React.FC<{ children: ReactNode }> {
  const registry = createSurfaceRegistry(surfaces);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname={pathname}>
        {children}
      </SurfaceManagerProvider>
    );
  };
}

describe('useSurfacePalette', () => {
  it("returns the active surface's palette", () => {
    const { result } = renderHook(() => useSurfacePalette(), {
      wrapper: wrap('/aether/drift', [driftWithPalette]),
    });
    expect(result.current).toBe(CUSTOM);
  });

  it('falls back to default when surface has no palette', () => {
    const { result } = renderHook(() => useSurfacePalette(), {
      wrapper: wrap('/aether/journey/x', [atlasNoPalette]),
    });
    expect(result.current).toBe(DEFAULT_SURFACE_PALETTE);
  });

  it('falls back to default when no surface matches', () => {
    const { result } = renderHook(() => useSurfacePalette(), {
      wrapper: wrap('/nowhere', [driftWithPalette]),
    });
    expect(result.current).toBe(DEFAULT_SURFACE_PALETTE);
  });
});

describe('useSurfacePaletteSlots', () => {
  it('exposes named slots for the active palette', () => {
    const { result } = renderHook(() => useSurfacePaletteSlots(), {
      wrapper: wrap('/aether/drift', [driftWithPalette]),
    });
    expect(result.current).toEqual(slotsFor(CUSTOM));
  });
});

describe('<SurfacePaletteVars/>', () => {
  it('writes palette + slot CSS vars on documentElement.style', () => {
    const Wrap = wrap('/aether/drift', [driftWithPalette]);
    render(
      <Wrap>
        <SurfacePaletteVars />
      </Wrap>,
    );
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--aether-palette-0')).toBe('#000000');
    expect(root.style.getPropertyValue('--aether-palette-2')).toBe('#FF0000');
    expect(root.style.getPropertyValue('--aether-palette-accent')).toBe('#FF0000');
    expect(root.style.getPropertyValue('--aether-palette-surface')).toBe('#FFFFFF');
  });

  it('removes the vars on unmount', () => {
    const Wrap = wrap('/aether/drift', [driftWithPalette]);
    const { unmount } = render(
      <Wrap>
        <SurfacePaletteVars />
      </Wrap>,
    );
    unmount();
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--aether-palette-0')).toBe('');
    expect(root.style.getPropertyValue('--aether-palette-accent')).toBe('');
  });

  it('honours target="body"', () => {
    const Wrap = wrap('/aether/drift', [driftWithPalette]);
    render(
      <Wrap>
        <SurfacePaletteVars target="body" />
      </Wrap>,
    );
    expect(document.body.style.getPropertyValue('--aether-palette-accent')).toBe('#FF0000');
  });

  it('falls back to default palette vars when surface has no palette', () => {
    const Wrap = wrap('/aether/journey/x', [atlasNoPalette]);
    render(
      <Wrap>
        <SurfacePaletteVars />
      </Wrap>,
    );
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--aether-palette-1')).toBe(DEFAULT_SURFACE_PALETTE[1]);
    expect(root.style.getPropertyValue('--aether-palette-accent')).toBe(DEFAULT_SURFACE_PALETTE[2]);
  });

  it('renders children verbatim', () => {
    const Wrap = wrap('/aether/drift', [driftWithPalette]);
    const { getByText } = render(
      <Wrap>
        <SurfacePaletteVars>
          <span>hello</span>
        </SurfacePaletteVars>
      </Wrap>,
    );
    expect(getByText('hello')).toBeTruthy();
  });
});
