/** Vitest specs for AE459 <Phase1CompassShell>. */
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useCompassBearing } from '../../src/components/aether/phase1/compass-bearing-context';

// ---- mocks for heavy / R3F dependencies ---------------------------------

vi.mock('@app/aether-canvas', () => ({
  SurfaceCanvas: ({ children, ariaLabel }: { children?: ReactNode; ariaLabel?: string }) => (
    <div data-mock-surface-canvas aria-label={ariaLabel}>
      {children}
    </div>
  ),
}));

vi.mock('@app/aether-audio', () => ({
  SurfaceAudioLayer: () => <div data-mock-surface-audio />,
  useSceneAudioBridge: () => ({
    status: 'idle',
    activate: async (): Promise<void> => {},
    onChannelWrite: (_g: { drone: number; events: number }): void => {},
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: (): string => '/aether/atlas',
}));

vi.mock('../../src/components/aether/phase1/phase1-continuum-bar', () => ({
  Phase1ContinuumBar: () => <div data-mock-continuum-bar />,
}));
vi.mock('../../src/components/aether/phase1/phase1-continuum-receiver-toast', () => ({
  Phase1ContinuumReceiverToast: () => <div data-mock-receiver-toast />,
}));
vi.mock('../../src/components/aether/phase1/phase1-dev-nav', () => ({
  Phase1DevNav: ({ active }: { active?: string }) => (
    <div data-mock-dev-nav data-active={active ?? ''} />
  ),
}));
vi.mock('../../src/components/aether/phase1/phase1-pulse-overlay', () => ({
  Phase1PulseOverlay: () => <div data-mock-pulse-overlay />,
}));
vi.mock('../../src/components/aether/phase2/phase2-genie-modal', () => ({
  Phase2GenieModal: () => <div data-mock-genie-modal />,
}));

vi.mock('../../src/components/aether/phase1/use-lifecycle-driver', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/components/aether/phase1/use-lifecycle-driver')
  >('../../src/components/aether/phase1/use-lifecycle-driver');
  return {
    ...actual,
    useLifecycleAutoDriver: (): void => {},
  };
});

import { Phase1CompassShell } from '../../src/components/aether/phase1/phase1-compass-shell';
import { CompassBearingProvider } from '../../src/components/aether/phase1/compass-bearing-context';

function renderShell(bearing?: number): HTMLElement {
  const { container } =
    bearing === undefined
      ? render(<Phase1CompassShell />)
      : render(<Phase1CompassShell bearing={bearing} />);
  return container;
}

describe('<Phase1CompassShell/> — outer scene container', () => {
  it('renders the mocked SurfaceCanvas with the Compass aria-label', () => {
    const root = renderShell();
    const canvas = root.querySelector('[data-mock-surface-canvas]');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-label')).toBe('Compass — Phase 1 surface');
  });

  it('mounts the audio layer + pulse overlay + continuum siblings', () => {
    const root = renderShell();
    expect(root.querySelector('[data-mock-surface-audio]')).not.toBeNull();
    expect(root.querySelector('[data-mock-pulse-overlay]')).not.toBeNull();
    expect(root.querySelector('[data-mock-continuum-bar]')).not.toBeNull();
    expect(root.querySelector('[data-mock-receiver-toast]')).not.toBeNull();
  });

  it('passes active="compass" to the dev nav', () => {
    const root = renderShell();
    expect(root.querySelector('[data-mock-dev-nav]')?.getAttribute('data-active')).toBe('compass');
  });

  it('mounts the Genie modal sibling (closed by default)', () => {
    const root = renderShell();
    expect(root.querySelector('[data-mock-genie-modal]')).not.toBeNull();
  });
});

describe('<Phase1CompassShell/> — CompassBearingProvider wiring', () => {
  it('defaults the bearing to 0° when no prop is passed', () => {
    let observed: number | null = null;
    function Probe(): React.ReactElement {
      observed = useCompassBearing();
      return <div data-probe />;
    }
    render(
      <CompassBearingProvider>
        <Probe />
      </CompassBearingProvider>,
    );
    expect(observed).toBe(0);
  });

  it('propagates a custom bearing through the provider', () => {
    let observed: number | null = null;
    function Probe(): React.ReactElement {
      observed = useCompassBearing();
      return <div data-probe />;
    }
    render(
      <CompassBearingProvider bearing={123}>
        <Probe />
      </CompassBearingProvider>,
    );
    expect(observed).toBe(123);
  });

  it('useCompassBearing() returns 0° (north) when no provider is mounted', () => {
    let observed: number | null = null;
    function Probe(): React.ReactElement {
      observed = useCompassBearing();
      return <div data-probe />;
    }
    render(<Probe />);
    expect(observed).toBe(0);
  });

  it('the shell renders successfully with a non-zero bearing prop', () => {
    const root = renderShell(45);
    // The shell itself wraps Phase1CompassInner in the provider; we can't
    // easily probe inside the shell's own provider tree without piercing
    // the SurfaceCanvas mock's children, but the SurfaceCanvas mock + the
    // dev nav + the pulse overlay are observable proof the inner tree
    // mounted under the new bearing without throwing.
    expect(root.querySelector('[data-mock-surface-canvas]')).not.toBeNull();
    expect(root.querySelector('[data-mock-pulse-overlay]')).not.toBeNull();
  });
});
