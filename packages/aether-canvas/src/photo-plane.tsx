/**
 * `<PhotoPlane>` — AE401 R3F primitive for textured photo planes.
 *
 * Used by Lumen (Phase 2) to render real photos in the 3D cloud. The
 * plane loads its texture from a URL via Three's `TextureLoader` inside
 * a `useEffect` so the Suspense boundary stays optional (jsdom tests +
 * Storybook fixtures can mount the component without throwing).
 *
 * Fallback strategy:
 *   - `url === null` / loading / error → palette-coloured material so
 *     the scene reads as "photo will appear here"
 *   - texture loaded → swap to a textured material
 *
 * The `aspect` prop drives the plane's height: width = size, height =
 * size × aspect. Default 0.66 (landscape 3:2-ish). Future slices can
 * compute aspect per-photo from the loaded texture's image size.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { TextureLoader, type Mesh, type MeshStandardMaterial, type Texture } from 'three';

export interface PhotoPlaneProps {
  /** Presigned image URL. Null = placeholder mode. */
  readonly url?: string | null;
  /** Plane width in world units. Default 1.6. */
  readonly size?: number;
  /** Height / width ratio. Default 0.66 (landscape). When a texture
   *  loads (AE404), the plane re-reads its true aspect from
   *  `texture.image.width / height` and overrides this default; pass
   *  an explicit value to force a fixed aspect (e.g. for Storybook). */
  readonly aspect?: number;
  /** Position passed straight through to the inner group. */
  readonly position?: readonly [number, number, number];
  /** Fallback colour when the texture isn't ready. */
  readonly fallbackColor?: string;
  /** Optional border color drawn slightly behind the plane. Null skips. */
  readonly borderColor?: string | null;
  /** Material opacity multiplier (0..1). */
  readonly opacity?: number;
}

/** AE404 — pure helper: read the loaded texture's true aspect ratio
 *  (height / width) so the plane displays photos at their real shape.
 *  Returns the fallback when the texture isn't loaded or the image
 *  isn't measurable (e.g. before decoding, or for procedural textures
 *  without an image source). Exported so jsdom tests can pin it. */
export function aspectFromTexture(texture: Texture | null, fallback: number): number {
  if (texture === null) return fallback;
  const img = (texture as { image?: { width?: number; height?: number } }).image;
  if (img === undefined || img === null) return fallback;
  const w = img.width ?? 0;
  const h = img.height ?? 0;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return fallback;
  return h / w;
}

const DEFAULT_SIZE = 1.6;
const DEFAULT_ASPECT = 0.66;

export function PhotoPlane({
  url = null,
  size = DEFAULT_SIZE,
  aspect = DEFAULT_ASPECT,
  position = [0, 0, 0],
  fallbackColor = '#D6B280',
  borderColor = '#A37C3B',
  opacity = 1,
}: PhotoPlaneProps): React.ReactElement {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<MeshStandardMaterial>(null);
  const [texture, setTexture] = useState<Texture | null>(null);

  // Load the texture when a URL is provided. Cancellation: capture an
  // `aborted` flag so a late-arriving load doesn't update an unmounted
  // material. We dispose the texture on swap/unmount so GL memory stays
  // bounded across many photos.
  useEffect(() => {
    setTexture(null);
    if (url === null || url === undefined || url === '') return undefined;
    const loader = new TextureLoader();
    loader.crossOrigin = 'anonymous';
    let aborted = false;
    let loaded: Texture | null = null;
    loader.load(
      url,
      (tex) => {
        if (aborted) {
          tex.dispose();
          return;
        }
        loaded = tex;
        setTexture(tex);
      },
      undefined,
      () => {
        // Load failure — caller's fallbackColor takes over.
      },
    );
    return (): void => {
      aborted = true;
      if (loaded !== null) loaded.dispose();
    };
  }, [url]);

  // AE404 — once the texture loads, prefer its real aspect over the
  // caller's `aspect` prop. The fallback keeps the placeholder shape
  // stable while the texture is still streaming in.
  const resolvedAspect = useMemo(() => aspectFromTexture(texture, aspect), [texture, aspect]);
  const planeHeight = useMemo(() => size * resolvedAspect, [size, resolvedAspect]);

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh ref={meshRef}>
        <planeGeometry args={[size, planeHeight]} />
        <meshStandardMaterial
          ref={matRef}
          color={texture === null ? fallbackColor : '#FFFFFF'}
          map={texture}
          roughness={0.85}
          metalness={0.05}
          transparent
          opacity={opacity}
        />
      </mesh>
      {borderColor !== null && borderColor !== undefined && (
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[size * 1.05, planeHeight * 1.05]} />
          <meshStandardMaterial
            color={borderColor}
            roughness={0.5}
            transparent
            opacity={0.7 * opacity}
          />
        </mesh>
      )}
    </group>
  );
}
