/** AE374 — SurfaceMountFrame specs. */
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SurfaceManagerProvider } from '../../src/surface/manager';
import { SurfaceMountFrame } from '../../src/surface/mount';
import { createSurfaceRegistry } from '../../src/surface/registry';
import type { Surface, SurfaceMountProps } from '../../src/surface/types';

const drift: Surface = {
  id: 'drift',
  phase: 1,
  route: { kind: 'literal', pathname: '/aether' },
};

function FakeScene({ surface, phase }: SurfaceMountProps): React.ReactElement {
  return (
    <div data-testid="fake-scene" data-surface={surface.id} data-phase={phase}>
      scene
    </div>
  );
}

const driftWithMount: Surface = {
  ...drift,
  mount: () => Promise.resolve({ default: FakeScene }),
};

function wrap(
  initialPathname: string,
  surfaces: ReadonlyArray<Surface>,
): React.FC<{ children: ReactNode }> {
  const registry = createSurfaceRegistry(surfaces);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
        {children}
      </SurfaceManagerProvider>
    );
  };
}

describe('SurfaceMountFrame — no surface matches', () => {
  it('renders the empty placeholder', () => {
    const Wrap = wrap('/nowhere', [drift]);
    const { getByTestId } = render(
      <Wrap>
        <SurfaceMountFrame />
      </Wrap>,
    );
    expect(getByTestId('aether-surface-empty')).toBeTruthy();
  });
});

describe('SurfaceMountFrame — surface without a mount loader', () => {
  it('renders the placeholder with the surface id + phase data attrs', () => {
    const Wrap = wrap('/aether', [drift]);
    const { getByTestId } = render(
      <Wrap>
        <SurfaceMountFrame />
      </Wrap>,
    );
    const node = getByTestId('aether-surface-placeholder');
    expect(node.getAttribute('data-aether-surface')).toBe('drift');
    expect(node.getAttribute('data-aether-phase')).toBe('idle');
  });

  it('accepts a custom fallback', () => {
    const Wrap = wrap('/aether', [drift]);
    const { getByText } = render(
      <Wrap>
        <SurfaceMountFrame fallback={<span>custom fallback</span>} />
      </Wrap>,
    );
    expect(getByText('custom fallback')).toBeTruthy();
  });
});

describe('SurfaceMountFrame — surface with a mount loader', () => {
  it('renders the lazy scene after the loader resolves', async () => {
    const Wrap = wrap('/aether', [driftWithMount]);
    const { findByTestId } = render(
      <Wrap>
        <SurfaceMountFrame />
      </Wrap>,
    );
    const scene = await findByTestId('fake-scene');
    expect(scene.getAttribute('data-surface')).toBe('drift');
    expect(scene.getAttribute('data-phase')).toBe('idle');
  });
});

describe('SurfaceMountFrame — explicit surface override', () => {
  it('renders the override surface even outside the route match', () => {
    const Wrap = wrap('/nowhere', [driftWithMount]);
    const { getByTestId } = render(
      <Wrap>
        <SurfaceMountFrame surface={drift} />
      </Wrap>,
    );
    // Override has no mount → falls back to placeholder.
    const node = getByTestId('aether-surface-placeholder');
    expect(node.getAttribute('data-aether-surface')).toBe('drift');
  });
});

describe('SurfaceMountFrame — background style', () => {
  it('applies the background prop to the frame', () => {
    const Wrap = wrap('/aether', [drift]);
    const { getByTestId } = render(
      <Wrap>
        <SurfaceMountFrame background="#1A0F09" />
      </Wrap>,
    );
    const node = getByTestId('aether-surface-placeholder');
    expect(node.style.background).toBe('rgb(26, 15, 9)');
  });
});
