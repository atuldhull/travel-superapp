/**
 * Sharp variant generator — copy of the apps/api SharpImageProcessor
 * (apps/api/src/modules/media/infrastructure/sharp-image-processor.ts)
 * with the Nest decorators stripped. Same variant specs (thumb 256w q70,
 * medium 1024w q80), same WebP settings, same single-decode pipeline.
 *
 * Kept as a local copy (not a shared package) for [S-B2]: the two
 * processors will stay in sync via fitness gate / drift check until
 * a `@app/media-pipeline` package is worth the abstraction. Right
 * now there are exactly two consumers (apps/api inline + this worker),
 * so the copy is cheaper than the abstraction.
 *
 * Installed by [S-B2] of the S-series real-functionality closeout.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export type VariantLabel = 'thumb' | 'medium';

export interface GeneratedVariant {
  readonly label: VariantLabel;
  readonly buffer: Buffer;
  readonly format: 'webp';
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
}

interface VariantSpec {
  readonly label: VariantLabel;
  readonly width: number;
  readonly quality: number;
}

const VARIANT_SPECS: readonly VariantSpec[] = [
  { label: 'thumb', width: 256, quality: 70 },
  { label: 'medium', width: 1024, quality: 80 },
];

export async function generateVariants(source: Buffer): Promise<GeneratedVariant[]> {
  // Decode once; resize/encode per variant. Sharp's pipeline is
  // immutable from `clone()` onward so each variant gets its own
  // resize without disturbing the others.
  const decoded = sharp(source, { failOn: 'truncated' });
  return Promise.all(VARIANT_SPECS.map((spec) => renderVariant(decoded.clone(), spec)));
}

async function renderVariant(pipeline: sharp.Sharp, spec: VariantSpec): Promise<GeneratedVariant> {
  const { data, info } = await pipeline
    .rotate() // auto-orient from EXIF, then strip EXIF on encode
    .resize({ width: spec.width, withoutEnlargement: true })
    .webp({ quality: spec.quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const sha256 = createHash('sha256').update(data).digest('hex');
  return {
    label: spec.label,
    buffer: data,
    format: 'webp',
    width: info.width,
    height: info.height,
    bytes: info.size,
    sha256,
  };
}
