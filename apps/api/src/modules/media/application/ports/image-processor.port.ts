/**
 * Port: image-variant generator. The confirm-upload use-case feeds
 * the original bytes in and gets back N variants (thumb, medium,
 * etc.) — each with the metadata we persist in `MediaAsset.variants`.
 *
 * Single adapter today:
 *   - `SharpImageProcessor` — libvips-backed pipeline that produces
 *     WebP variants at the configured widths. WebP picked because
 *     it's the smallest format that still has 99%+ browser support
 *     in 2026 (no need for a JPEG fallback variant).
 *
 * Adding a format / size is purely additive — append a row to the
 * adapter's `VARIANT_SPECS` array and the use-case gets it for free.
 *
 * Installed by prompt [POST.5].
 */
export const IMAGE_PROCESSOR_PORT = Symbol('IMAGE_PROCESSOR_PORT');

/** Label used to identify a variant in the persisted `variants` array
 *  and in the URL helpers. Kept open-ended (string) so adding a
 *  4th variant later doesn't require a port change. */
export type VariantLabel = 'thumb' | 'medium' | (string & {});

export interface ImageVariantInput {
  readonly label: VariantLabel;
  readonly buffer: Buffer;
  readonly format: 'webp';
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  /** sha256 hex digest of `buffer`. The confirm-upload use-case uses
   *  it for the S3 ETag verify after `putObject`. */
  readonly sha256: string;
}

export interface ImageProcessorPort {
  /** Generate every configured variant from the source `Buffer`.
   *  Throws if libvips cannot decode the input (corrupt JPEG, EXIF-
   *  malformed PNG, non-image bytes). Caller should treat a throw as
   *  non-fatal — the asset is already marked `ready` and orphan
   *  pixels are tolerable. */
  generate(source: Buffer): Promise<readonly ImageVariantInput[]>;
}
