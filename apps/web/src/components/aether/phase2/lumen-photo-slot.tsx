'use client';

/**
 * AE401 — `<LumenPhotoSlot>` per-asset loader.
 *
 * The Lumen scene renders one slot per asset. Each slot owns its own
 * `useMediaControllerDownloadUrl(assetId)` query — rules-of-hooks
 * compliant because each slot is a stable render position, not a loop
 * inside the parent.
 *
 * The slot hands the resolved URL (or null while pending) to
 * `<PhotoPlane>` from `@app/aether-canvas`. PhotoPlane shows its
 * fallback palette swatch until the texture loads, so the cloud feels
 * "alive" even while individual planes resolve.
 */
import { useMemo } from 'react';
import { PhotoPlane } from '@app/aether-canvas';
import { useSurfacePaletteSlots } from '@app/aether-core';
import { useMediaControllerDownloadUrl, type MediaDownloadUrlResponseDto } from '@app/sdk';
import { extractDownloadUrl } from './media-download-url';

export interface LumenPhotoSlotProps {
  readonly assetId: string;
  readonly size: number;
  readonly position: readonly [number, number, number];
  /** Lifecycle-driven opacity multiplier (0..1). */
  readonly opacity?: number;
  /** When true, skip the SDK call entirely (Storybook / signed-out). */
  readonly disableFetch?: boolean;
}

export function LumenPhotoSlot({
  assetId,
  size,
  position,
  opacity = 1,
  disableFetch = false,
}: LumenPhotoSlotProps): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  const query = useMediaControllerDownloadUrl(assetId, {
    query: { enabled: !disableFetch && assetId !== '', retry: 1, staleTime: 4 * 60 * 1000 },
  });
  const url = useMemo<string | null>(() => {
    if (disableFetch) return null;
    return extractDownloadUrl(query.data?.data as MediaDownloadUrlResponseDto | undefined);
  }, [disableFetch, query.data]);
  return (
    <PhotoPlane
      url={url}
      size={size}
      position={position}
      fallbackColor={palette.glow}
      borderColor={palette.accent}
      opacity={opacity}
    />
  );
}
