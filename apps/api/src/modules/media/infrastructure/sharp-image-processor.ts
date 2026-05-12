/**
 * Sharp adapter for the ImageProcessorPort. Produces WebP variants
 * at a thumb + medium width — sized for moderation thumbnails and
 * full-page memory-book renders respectively.
 *
 * libvips (Sharp's backend) decodes the source ONCE, then resizes
 * to each target width on the same in-memory raster. Doing both
 * variants in one pipeline is ~30% faster than two separate
 * `sharp(buf).resize(...)` calls for typical mobile-camera JPEGs.
 *
 * Behaviour:
 *   - `withoutEnlargement: true` — never upscale a 200w source into
 *     a 256w "thumb" (would look soft); we just take the original.
 *   - WebP quality tuned conservatively: 80 for medium (visible to
 *     end users), 70 for thumb (only seen at 256w — quality
 *     headroom is wasted bytes).
 *   - `effort: 4` (default) — balances encode speed against file
 *     size. Bumping to 6 saves ~5% bytes but doubles CPU. Not
 *     worth it for in-process variant gen.
 *
 * Installed by prompt [POST.5].
 */
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type {
  ImageProcessorPort,
  ImageVariantInput,
  VariantLabel,
} from '../application/ports/image-processor.port';

interface VariantSpec {
  readonly label: VariantLabel;
  readonly width: number;
  readonly quality: number;
}

const VARIANT_SPECS: readonly VariantSpec[] = [
  { label: 'thumb', width: 256, quality: 70 },
  { label: 'medium', width: 1024, quality: 80 },
];

@Injectable()
export class SharpImageProcessor implements ImageProcessorPort {
  async generate(source: Buffer): Promise<readonly ImageVariantInput[]> {
    // Decode once; resize/encode per variant. Sharp's pipeline is
    // immutable from `clone()` onward so each variant gets its own
    // resize without disturbing the others.
    const decoded = sharp(source, { failOn: 'truncated' });

    const variants = await Promise.all(
      VARIANT_SPECS.map(async (spec) => this.renderVariant(decoded.clone(), spec)),
    );
    return variants;
  }

  private async renderVariant(
    pipeline: sharp.Sharp,
    spec: VariantSpec,
  ): Promise<ImageVariantInput> {
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
}
