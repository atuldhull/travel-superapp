/** Vitest specs for AE462 `<LumenPhotoSlot/>` — jsdom integration. */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { SurfaceManagerProvider, createSurfaceRegistry } from '@app/aether-core';
import type { ReactNode } from 'react';

// Mock @app/sdk so the slot's `useMediaControllerDownloadUrl` returns a
// controllable shape without spinning up react-query.
const downloadUrlMock = vi.fn();
const refetchMock = vi.fn();
vi.mock('@app/sdk', () => ({
  useMediaControllerDownloadUrl: (...args: unknown[]) => downloadUrlMock(...args),
}));

// Mock @app/aether-canvas's `<PhotoPlane>` so the slot can mount in
// jsdom (the real PhotoPlane renders R3F intrinsics like `<mesh>` that
// React DOM cannot reconcile). The mock surfaces the load-bearing props
// as data attributes so tests can assert what the slot forwarded.
vi.mock('@app/aether-canvas', () => ({
  PhotoPlane: ({
    url,
    size,
    position,
    fallbackColor,
    borderColor,
    opacity,
  }: {
    url?: string | null;
    size?: number;
    position?: readonly [number, number, number];
    fallbackColor?: string;
    borderColor?: string | null;
    opacity?: number;
  }): React.ReactElement => (
    <div
      data-testid="photo-plane-mock"
      data-url={url ?? ''}
      data-size={String(size ?? '')}
      data-position={(position ?? []).join(',')}
      data-fallback-color={fallbackColor ?? ''}
      data-border-color={borderColor ?? ''}
      data-opacity={String(opacity ?? '')}
    />
  ),
}));

import { LumenPhotoSlot } from '../../src/components/aether/phase2/lumen-photo-slot';

function fakeQuery(
  data: { url?: string; expiresAt?: string } | undefined,
  partial: object = {},
): object {
  return {
    data: data === undefined ? undefined : { data, status: 200 },
    isPending: false,
    isError: false,
    refetch: refetchMock,
    ...partial,
  };
}

function withShell(children: ReactNode): React.ReactElement {
  const registry = createSurfaceRegistry([
    { id: 'lumen', phase: 2, route: { kind: 'literal', pathname: '/aether/memory/test' } },
  ]);
  return (
    <SurfaceManagerProvider registry={registry} initialPathname="/aether/memory/test">
      {children}
    </SurfaceManagerProvider>
  );
}

function plane(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="photo-plane-mock"]');
}

describe('<LumenPhotoSlot/> integration', () => {
  beforeEach(() => {
    downloadUrlMock.mockReset();
    refetchMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('forwards the assetId + retry options to useMediaControllerDownloadUrl', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined));
    render(withShell(<LumenPhotoSlot assetId="asset-1" size={1.6} position={[0, 0, 0]} />));
    const [id, options] = downloadUrlMock.mock.calls[0]!;
    expect(id).toBe('asset-1');
    expect(options).toMatchObject({ query: { enabled: true, retry: 1 } });
    expect(options.query.staleTime).toBe(4 * 60 * 1000);
  });

  it('disableFetch=true sets query.enabled=false', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined));
    render(
      withShell(<LumenPhotoSlot assetId="asset-1" size={1.6} position={[0, 0, 0]} disableFetch />),
    );
    const [, options] = downloadUrlMock.mock.calls[0]!;
    expect(options.query.enabled).toBe(false);
  });

  it('empty-string assetId disables the SDK call', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined));
    render(withShell(<LumenPhotoSlot assetId="" size={1.6} position={[0, 0, 0]} />));
    const [, options] = downloadUrlMock.mock.calls[0]!;
    expect(options.query.enabled).toBe(false);
  });

  it('passes url=null to PhotoPlane while the SDK call is pending', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined, { isPending: true }));
    const { container } = render(
      withShell(<LumenPhotoSlot assetId="asset-1" size={1.6} position={[1, 2, 3]} />),
    );
    const el = plane(container);
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-url')).toBe('');
  });

  it('extracts and forwards the presigned URL when the response resolves', () => {
    downloadUrlMock.mockReturnValue(
      fakeQuery({ url: 'https://cdn.example/a.jpg', expiresAt: '2030-01-01T00:00:00.000Z' }),
    );
    const { container } = render(
      withShell(<LumenPhotoSlot assetId="asset-1" size={1.6} position={[0, 0, 0]} />),
    );
    expect(plane(container)?.getAttribute('data-url')).toBe('https://cdn.example/a.jpg');
  });

  it('disableFetch=true forces url=null even if the mock would return one', () => {
    downloadUrlMock.mockReturnValue(
      fakeQuery({ url: 'https://cdn.example/a.jpg', expiresAt: '2030-01-01T00:00:00.000Z' }),
    );
    const { container } = render(
      withShell(<LumenPhotoSlot assetId="asset-1" size={1.6} position={[0, 0, 0]} disableFetch />),
    );
    expect(plane(container)?.getAttribute('data-url')).toBe('');
  });

  it('forwards size + position + opacity verbatim to PhotoPlane', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined));
    const { container } = render(
      withShell(
        <LumenPhotoSlot assetId="asset-1" size={2.4} position={[4, -1, 0.5]} opacity={0.3} />,
      ),
    );
    const el = plane(container);
    expect(el?.getAttribute('data-size')).toBe('2.4');
    expect(el?.getAttribute('data-position')).toBe('4,-1,0.5');
    expect(el?.getAttribute('data-opacity')).toBe('0.3');
  });

  it('opacity defaults to 1 when not provided', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined));
    const { container } = render(
      withShell(<LumenPhotoSlot assetId="asset-1" size={1.6} position={[0, 0, 0]} />),
    );
    expect(plane(container)?.getAttribute('data-opacity')).toBe('1');
  });

  it('forwards palette glow + accent as fallback / border colors', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined));
    const { container } = render(
      withShell(<LumenPhotoSlot assetId="asset-1" size={1.6} position={[0, 0, 0]} />),
    );
    const el = plane(container);
    // The default surface palette is non-empty — assert hex-ish strings.
    expect(el?.getAttribute('data-fallback-color')).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
    expect(el?.getAttribute('data-border-color')).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
  });

  it('omits the onClick handler when no `onClick` prop is supplied', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined));
    const { container } = render(
      withShell(<LumenPhotoSlot assetId="asset-1" size={1.6} position={[0, 0, 0]} />),
    );
    // The wrapping `<group>` is an unknown DOM element under jsdom.
    const group = container.querySelector('group');
    expect(group).not.toBeNull();
    // No onclick attribute means React didn't attach a listener prop.
    expect((group as unknown as { onclick: unknown }).onclick).toBeNull();
  });

  it('invokes onClick + stopPropagation when the wrapping group is clicked', () => {
    downloadUrlMock.mockReturnValue(fakeQuery(undefined));
    const onClick = vi.fn();
    const onOuterClick = vi.fn();
    const { container } = render(
      withShell(
        <div onClick={onOuterClick}>
          <LumenPhotoSlot assetId="asset-1" size={1.6} position={[0, 0, 0]} onClick={onClick} />
        </div>,
      ),
    );
    const group = container.querySelector('group') as HTMLElement;
    expect(group).not.toBeNull();
    fireEvent.click(group);
    expect(onClick).toHaveBeenCalledTimes(1);
    // stopPropagation should prevent the outer listener from firing.
    expect(onOuterClick).not.toHaveBeenCalled();
  });
});
