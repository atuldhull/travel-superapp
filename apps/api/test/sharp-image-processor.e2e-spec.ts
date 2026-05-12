/**
 * POST.5 — Sharp variant pipeline smoke test.
 *
 * Verifies:
 *   1. SharpImageProcessor decodes a synthetic PNG and produces the
 *      configured variants (thumb + medium WebP).
 *   2. The buffer + metadata shape matches what `confirm-upload`
 *      will persist on `MediaAsset.variants`.
 *
 * Pure-Node test — no S3 / MinIO touch. The full confirm-upload
 * flow (download → Sharp → S3 PUT → DB write) is covered indirectly
 * by every existing `media` e2e suite — those suites now exercise
 * the variant pipeline whenever they call confirm-upload with a
 * `kind: 'image'` row.
 */
import sharp from 'sharp';
import { SharpImageProcessor } from '../src/modules/media/infrastructure/sharp-image-processor';

describe('POST.5 — SharpImageProcessor (variant pipeline)', () => {
  let source: Buffer;

  beforeAll(async () => {
    // Synthetic 2048×1024 PNG (a single solid colour) — large
    // enough that "withoutEnlargement: true" doesn't trigger and
    // both variants actually downsize.
    source = await sharp({
      create: {
        width: 2048,
        height: 1024,
        channels: 3,
        background: { r: 200, g: 80, b: 60 },
      },
    })
      .png()
      .toBuffer();
  });

  it('emits both thumb and medium variants', async () => {
    const proc = new SharpImageProcessor();
    const variants = await proc.generate(source);
    expect(variants).toHaveLength(2);
    const labels = variants.map((v) => v.label).sort();
    expect(labels).toEqual(['medium', 'thumb']);
  });

  it('sizes thumb to 256w and medium to 1024w while preserving aspect ratio', async () => {
    const proc = new SharpImageProcessor();
    const variants = await proc.generate(source);
    const thumb = variants.find((v) => v.label === 'thumb');
    const medium = variants.find((v) => v.label === 'medium');
    expect(thumb).toBeDefined();
    expect(medium).toBeDefined();
    expect(thumb!.width).toBe(256);
    // 2048×1024 source ⇒ 256×128 thumb (preserves 2:1 aspect).
    expect(thumb!.height).toBe(128);
    expect(medium!.width).toBe(1024);
    expect(medium!.height).toBe(512);
  });

  it('encodes both variants as WebP with non-empty buffers + a sha256', async () => {
    const proc = new SharpImageProcessor();
    const variants = await proc.generate(source);
    for (const v of variants) {
      expect(v.format).toBe('webp');
      expect(v.buffer.length).toBeGreaterThan(0);
      expect(v.bytes).toBe(v.buffer.length);
      // sha256 hex is exactly 64 chars.
      expect(v.sha256).toMatch(/^[0-9a-f]{64}$/);
      // First 4 bytes of a WebP are "RIFF".
      expect(v.buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
    }
  });

  it('throws when libvips cannot decode the input (corrupt bytes)', async () => {
    const proc = new SharpImageProcessor();
    const garbage = Buffer.from('this is not an image', 'utf8');
    await expect(proc.generate(garbage)).rejects.toThrow();
  });
});
