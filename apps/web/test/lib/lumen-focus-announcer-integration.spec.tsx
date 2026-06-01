/** Vitest specs for AE462 `<LumenFocusAnnouncer/>` — jsdom integration. */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SurfaceManagerProvider, createSurfaceRegistry } from '@app/aether-core';
import type { ReactNode } from 'react';
import { LumenFocusAnnouncer } from '../../src/components/aether/phase2/lumen-focus-announcer';
import { LumenDataProvider } from '../../src/components/aether/phase2/lumen-data-context';
import { LumenSelectionProvider } from '../../src/components/aether/phase2/lumen-selection-context';
import type { LumenPhotoLike } from '../../src/components/aether/phase2/lumen-cloud';

function photo(id: string, capturedAt: string, rating: number | null = 3): LumenPhotoLike {
  return { id, capturedAt, rating, url: null };
}

/** Three photos with strictly-increasing capture timestamps so the
 *  announcement helper produces a stable 1-of-3 / 2-of-3 / 3-of-3 walk. */
const PHOTOS: ReadonlyArray<LumenPhotoLike> = [
  photo('alpha', '2024-01-01T08:00:00.000Z', 5),
  photo('beta', '2024-01-02T08:00:00.000Z', 4),
  photo('gamma', '2024-01-03T08:00:00.000Z', 3),
];

function withLumenShell(
  children: ReactNode,
  opts: {
    readonly photos?: ReadonlyArray<LumenPhotoLike>;
    readonly focusedId?: string | null;
  } = {},
): React.ReactElement {
  const registry = createSurfaceRegistry([
    { id: 'lumen', phase: 2, route: { kind: 'literal', pathname: '/aether/memory/test' } },
  ]);
  const photos = opts.photos ?? PHOTOS;
  const focusedId = opts.focusedId ?? null;
  return (
    <SurfaceManagerProvider registry={registry} initialPathname="/aether/memory/test">
      <LumenDataProvider bookId="book-1" photos={photos}>
        <LumenSelectionProvider initialFocusedId={focusedId}>{children}</LumenSelectionProvider>
      </LumenDataProvider>
    </SurfaceManagerProvider>
  );
}

function announcer(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-aether-lumen-focus-announcer]');
}

describe('<LumenFocusAnnouncer/> integration', () => {
  it('renders a role=status aria-live=polite region', () => {
    const { container } = render(withLumenShell(<LumenFocusAnnouncer />));
    const region = announcer(container);
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
  });

  it('initial state (no focus, empty cloud) reads "Cloud overview"', () => {
    const { container } = render(
      withLumenShell(<LumenFocusAnnouncer />, { photos: [], focusedId: null }),
    );
    expect(announcer(container)?.textContent).toBe('Cloud overview');
  });

  it('overview mode with populated cloud still reads "Cloud overview"', () => {
    const { container } = render(withLumenShell(<LumenFocusAnnouncer />, { focusedId: null }));
    expect(announcer(container)?.textContent).toBe('Cloud overview');
  });

  it('focused id maps to "Photo N of M" via the time-sorted index', () => {
    const { container } = render(withLumenShell(<LumenFocusAnnouncer />, { focusedId: 'alpha' }));
    expect(announcer(container)?.textContent).toBe('Photo 1 of 3');
  });

  it('middle plane → Photo 2 of 3', () => {
    const { container } = render(withLumenShell(<LumenFocusAnnouncer />, { focusedId: 'beta' }));
    expect(announcer(container)?.textContent).toBe('Photo 2 of 3');
  });

  it('last plane → Photo 3 of 3', () => {
    const { container } = render(withLumenShell(<LumenFocusAnnouncer />, { focusedId: 'gamma' }));
    expect(announcer(container)?.textContent).toBe('Photo 3 of 3');
  });

  it('unknown focused id falls back to "Cloud overview"', () => {
    const { container } = render(
      withLumenShell(<LumenFocusAnnouncer />, { focusedId: 'does-not-exist' }),
    );
    expect(announcer(container)?.textContent).toBe('Cloud overview');
  });

  it('applies sr-only off-screen styling (visually hidden but readable)', () => {
    const { container } = render(withLumenShell(<LumenFocusAnnouncer />));
    const region = announcer(container);
    const style = region?.getAttribute('style') ?? '';
    // The exact serialisation jsdom emits is implementation-defined, so
    // we just pin the load-bearing visually-hidden properties.
    expect(style).toContain('position: absolute');
    expect(style).toContain('width: 1px');
    expect(style).toContain('height: 1px');
    expect(style).toContain('overflow: hidden');
    // jsdom serialises clip rect with `px` units; just check the shape.
    expect(style).toMatch(/clip: rect\(0(px)?, 0(px)?, 0(px)?, 0(px)?\)/);
    expect(style).toContain('white-space: nowrap');
  });

  it('outside any LumenDataProvider / LumenSelectionProvider, falls back to "Cloud overview"', () => {
    const registry = createSurfaceRegistry([
      { id: 'lumen', phase: 2, route: { kind: 'literal', pathname: '/aether/memory/test' } },
    ]);
    const { container } = render(
      <SurfaceManagerProvider registry={registry} initialPathname="/aether/memory/test">
        <LumenFocusAnnouncer />
      </SurfaceManagerProvider>,
    );
    expect(announcer(container)?.textContent).toBe('Cloud overview');
  });
});
