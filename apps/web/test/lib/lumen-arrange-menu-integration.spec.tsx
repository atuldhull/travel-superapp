/** Vitest specs for AE431 `<LumenArrangeMenu/>` — jsdom integration. */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { SurfaceManagerProvider, createSurfaceRegistry } from '@app/aether-core';
import type { ReactNode } from 'react';
import { LumenArrangeMenu } from '../../src/components/aether/phase2/lumen-arrange-menu';
import {
  LumenStrategyProvider,
  useLumenStrategy,
} from '../../src/components/aether/phase2/lumen-strategy-context';
import {
  LUMEN_LAYOUT_STRATEGIES,
  layoutStrategyLabel,
} from '../../src/components/aether/phase2/lumen-strategies';

function withLumenShell(
  children: ReactNode,
  initialStrategy?: 'time' | 'spiral' | 'wall' | 'grid' | 'mood',
): React.ReactElement {
  const registry = createSurfaceRegistry([
    { id: 'lumen', phase: 2, route: { kind: 'literal', pathname: '/aether/memory/test' } },
  ]);
  return (
    <SurfaceManagerProvider registry={registry} initialPathname="/aether/memory/test">
      <LumenStrategyProvider initialStrategy={initialStrategy}>{children}</LumenStrategyProvider>
    </SurfaceManagerProvider>
  );
}

function Probe(): React.ReactElement {
  const { strategy } = useLumenStrategy();
  return <output data-testid="probe">{strategy}</output>;
}

describe('<LumenArrangeMenu/> integration', () => {
  it('renders one button per strategy inside the nav', () => {
    const { container } = render(withLumenShell(<LumenArrangeMenu />));
    const nav = container.querySelector('nav[aria-label="Lumen layout strategies"]');
    expect(nav).not.toBeNull();
    const buttons = nav?.querySelectorAll('button');
    expect(buttons?.length).toBe(LUMEN_LAYOUT_STRATEGIES.length);
  });

  it('marks the initial strategy with aria-pressed=true', () => {
    const { container } = render(withLumenShell(<LumenArrangeMenu />, 'spiral'));
    const buttons = Array.from(container.querySelectorAll('button'));
    const spiral = buttons.find((b) => b.textContent?.startsWith(layoutStrategyLabel('spiral')));
    expect(spiral?.getAttribute('aria-pressed')).toBe('true');
    const time = buttons.find((b) => b.textContent?.startsWith(layoutStrategyLabel('time')));
    expect(time?.getAttribute('aria-pressed')).toBe('false');
  });

  it('appends "(AI)" to the mood button (strategy-stubbed)', () => {
    const { container } = render(withLumenShell(<LumenArrangeMenu />));
    const buttons = Array.from(container.querySelectorAll('button'));
    const mood = buttons.find((b) => b.textContent?.startsWith('Mood'));
    expect(mood?.textContent).toContain('(AI)');
  });

  it('does NOT append "(AI)" to non-stub strategies', () => {
    const { container } = render(withLumenShell(<LumenArrangeMenu />));
    const buttons = Array.from(container.querySelectorAll('button'));
    for (const s of ['time', 'grid', 'spiral', 'wall'] as const) {
      const b = buttons.find((btn) => btn.textContent?.startsWith(layoutStrategyLabel(s)));
      expect(b?.textContent).not.toContain('(AI)');
    }
  });

  it('clicking a button writes the strategy into the provider state', () => {
    const { container, getByTestId } = render(
      withLumenShell(
        <>
          <LumenArrangeMenu />
          <Probe />
        </>,
        'time',
      ),
    );
    expect(getByTestId('probe').textContent).toBe('time');
    const buttons = Array.from(container.querySelectorAll('button'));
    const wall = buttons.find((b) => b.textContent?.startsWith(layoutStrategyLabel('wall')));
    fireEvent.click(wall as HTMLElement);
    expect(getByTestId('probe').textContent).toBe('wall');
  });

  it('clicking flips the aria-pressed state across buttons', () => {
    const { container } = render(withLumenShell(<LumenArrangeMenu />, 'time'));
    const buttons = Array.from(container.querySelectorAll('button'));
    const grid = buttons.find((b) =>
      b.textContent?.startsWith(layoutStrategyLabel('grid')),
    ) as HTMLButtonElement;
    fireEvent.click(grid);
    expect(grid.getAttribute('aria-pressed')).toBe('true');
    const time = buttons.find((b) => b.textContent?.startsWith(layoutStrategyLabel('time')));
    expect(time?.getAttribute('aria-pressed')).toBe('false');
  });

  it('every button exposes the description as both title + aria-label', () => {
    const { container } = render(withLumenShell(<LumenArrangeMenu />));
    const buttons = Array.from(container.querySelectorAll('button'));
    for (const btn of buttons) {
      const title = btn.getAttribute('title');
      const label = btn.getAttribute('aria-label');
      expect(title).not.toBeNull();
      expect(title).toBe(label);
      expect(title?.length).toBeGreaterThan(0);
    }
  });
});
