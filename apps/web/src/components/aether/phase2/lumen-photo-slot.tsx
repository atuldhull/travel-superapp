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
import { extractDownloadExpiresAt, extractDownloadUrl } from './media-download-url';
import { useUrlTtlRefetch } from './use-url-ttl';

export interface LumenPhotoSlotProps {
  readonly assetId: string;
  readonly size: number;
  readonly position: readonly [number, number, number];
  /** Lifecycle-driven opacity multiplier (0..1). */
  readonly opacity?: number;
  /** When true, skip the SDK call entirely (Storybook / signed-out). */
  readonly disableFetch?: boolean;
  /** AE402 — click handler. R3F dispatches pointer events on meshes;
   *  the slot forwards onClick to the inner `<PhotoPlane>` via a
   *  wrapping group so the parent `<LumenPhase2Scene>` can drive
   *  selection state without each slot owning the context hook. */
  readonly onClick?: () => void;
}

export function LumenPhotoSlot({
  assetId,
  size,
  position,
  opacity = 1,
  disableFetch = false,
  onClick,
}: LumenPhotoSlotProps): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  const query = useMediaControllerDownloadUrl(assetId, {
    query: { enabled: !disableFetch && assetId !== '', retry: 1, staleTime: 4 * 60 * 1000 },
  });
  const url = useMemo<string | null>(() => {
    if (disableFetch) return null;
    return extractDownloadUrl(query.data?.data as MediaDownloadUrlResponseDto | undefined);
  }, [disableFetch, query.data]);
  // AE405 — refetch the presigned URL ~30s before its TTL expires so a
  // long-open Lumen session doesn't end up loading 403s.
  const expiresAt = useMemo<string | null>(() => {
    if (disableFetch) return null;
    return extractDownloadExpiresAt(query.data?.data as MediaDownloadUrlResponseDto | undefined);
  }, [disableFetch, query.data]);
  useUrlTtlRefetch(expiresAt, () => {
    void query.refetch();
  });
  // Wrap in a group so the parent can intercept pointer events without
  // PhotoPlane needing to know about them. Per R3F semantics, an
  // onClick on the group fires when any descendant mesh is clicked.
  return (
    <group
      onClick={
        onClick === undefined
          ? undefined
          : (e) => {
              e.stopPropagation();
              onClick();
            }
      }
    >
      <PhotoPlane
        url={url}
        size={size}
        position={position}
        fallbackColor={palette.glow}
        borderColor={palette.accent}
        opacity={opacity}
      />
    </group>
  );
}
