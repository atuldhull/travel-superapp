/** Vitest specs for AE390 <Phase1ContinuumBar>. */
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceManagerProvider, createSurfaceRegistry } from '@app/aether-core';
import type { ReactNode } from 'react';
import { Phase1ContinuumBar } from '../../src/components/aether/phase1/phase1-continuum-bar';

function wrap(opts?: {
  withContinuum?: boolean;
  pathname?: string;
}): React.FC<{ children: ReactNode }> {
  const withContinuum = opts?.withContinuum ?? true;
  const pathname = opts?.pathname ?? '/aether/drift';
  const registry = createSurfaceRegistry([
    { id: 'drift', phase: 1, route: { kind: 'literal', pathname: '/aether/drift' } },
    ...(withContinuum
      ? [{ id: 'continuum' as const, phase: 1 as const, route: { kind: 'overlay' as const } }]
      : []),
  ]);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname={pathname}>
        {children}
      </SurfaceManagerProvider>
    );
  };
}

describe('<Phase1ContinuumBar/> — outer bar', () => {
  it('renders the edge-bar when continuum surface is registered', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar />
      </Wrap>,
    );
    const bar = document.querySelector('[data-aether-continuum-bar]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-expanded')).toBe('false');
    expect(bar?.getAttribute('data-aether-continuum-edge')).toBe('bottom');
  });

  it('skips render when continuum NOT in the registry', () => {
    const Wrap = wrap({ withContinuum: false });
    render(
      <Wrap>
        <Phase1ContinuumBar />
      </Wrap>,
    );
    expect(document.querySelector('[data-aether-continuum-bar]')).toBeNull();
  });

  it('skips render when hidden=true', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar hidden />
      </Wrap>,
    );
    expect(document.querySelector('[data-aether-continuum-bar]')).toBeNull();
  });

  it('honours edge=top', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar edge="top" />
      </Wrap>,
    );
    expect(
      document
        .querySelector('[data-aether-continuum-bar]')
        ?.getAttribute('data-aether-continuum-edge'),
    ).toBe('top');
  });

  it('opens the popover on click', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar origin="https://app.example.com" />
      </Wrap>,
    );
    const bar = document.querySelector('[data-aether-continuum-bar]') as HTMLDivElement;
    expect(document.querySelector('[data-aether-continuum-popover]')).toBeNull();
    fireEvent.click(bar);
    expect(document.querySelector('[data-aether-continuum-popover]')).not.toBeNull();
    expect(bar.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens on Enter + Space', () => {
    const Wrap = wrap();
    const { rerender } = render(
      <Wrap>
        <Phase1ContinuumBar origin="https://app.example.com" />
      </Wrap>,
    );
    const bar = document.querySelector('[data-aether-continuum-bar]') as HTMLDivElement;
    fireEvent.keyDown(bar, { key: 'Enter' });
    expect(document.querySelector('[data-aether-continuum-popover]')).not.toBeNull();
    // Toggling closed again with Enter.
    fireEvent.keyDown(bar, { key: 'Enter' });
    expect(document.querySelector('[data-aether-continuum-popover]')).toBeNull();
    // Space also toggles open.
    rerender(
      <Wrap>
        <Phase1ContinuumBar origin="https://app.example.com" />
      </Wrap>,
    );
    const bar2 = document.querySelector('[data-aether-continuum-bar]') as HTMLDivElement;
    fireEvent.keyDown(bar2, { key: ' ' });
    expect(document.querySelector('[data-aether-continuum-popover]')).not.toBeNull();
  });

  it('initialOpen=true mounts the popover immediately', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar initialOpen origin="https://app.example.com" />
      </Wrap>,
    );
    expect(document.querySelector('[data-aether-continuum-popover]')).not.toBeNull();
  });
});

describe('<Phase1ContinuumBar/> — popover content', () => {
  it('renders the deep-link URL with origin + marker + extras', () => {
    const Wrap = wrap({ pathname: '/aether/journey/abc' });
    render(
      <Wrap>
        <Phase1ContinuumBar initialOpen origin="https://app.example.com" extras={{ trip: 'abc' }} />
      </Wrap>,
    );
    const url = document.querySelector('[data-aether-continuum-url]')?.textContent ?? '';
    expect(url.startsWith('https://app.example.com/aether/journey/abc?')).toBe(true);
    expect(url).toContain('trip=abc');
    expect(url).toContain('aether-continuum=1');
  });

  it('renders the inline SVG sigil', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar initialOpen origin="https://app.example.com" />
      </Wrap>,
    );
    const sigil = document.querySelector('[data-aether-continuum-sigil]');
    expect(sigil).not.toBeNull();
    expect(sigil?.tagName.toLowerCase()).toBe('svg');
    // Should have a non-zero number of <rect> cells.
    const rects = sigil?.querySelectorAll('rect');
    expect(rects?.length ?? 0).toBeGreaterThan(10);
  });

  it('Esc closes the popover', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar initialOpen origin="https://app.example.com" />
      </Wrap>,
    );
    expect(document.querySelector('[data-aether-continuum-popover]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('[data-aether-continuum-popover]')).toBeNull();
  });

  it('Copy button invokes navigator.clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar initialOpen origin="https://app.example.com" />
      </Wrap>,
    );
    const copyBtn = document.querySelector('[data-aether-continuum-copy]') as HTMLButtonElement;
    expect(copyBtn).not.toBeNull();
    fireEvent.click(copyBtn);
    // Microtask drain
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledTimes(1);
    const arg = writeText.mock.calls[0]?.[0];
    expect(String(arg).startsWith('https://app.example.com/aether/drift?')).toBe(true);
  });

  it('Share button invokes navigator.share when present', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar initialOpen origin="https://app.example.com" />
      </Wrap>,
    );
    const shareBtn = document.querySelector('[data-aether-continuum-share]') as HTMLButtonElement;
    fireEvent.click(shareBtn);
    await Promise.resolve();
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ title: expect.any(String) });
    expect(String(payload.url).startsWith('https://app.example.com/')).toBe(true);
  });

  it('close button closes the popover', () => {
    const Wrap = wrap();
    render(
      <Wrap>
        <Phase1ContinuumBar initialOpen origin="https://app.example.com" />
      </Wrap>,
    );
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(document.querySelector('[data-aether-continuum-popover]')).toBeNull();
  });
});
