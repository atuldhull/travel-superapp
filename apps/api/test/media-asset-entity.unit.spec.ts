/**
 * Unit tests for `MediaAsset.create()` + normaliseCaption() +
 * assertCanMarkReady() — pure domain test, no DB / Nest / mocks
 * ([G4.3]).
 */
import { ConflictError, ValidationError } from '@app/errors';
import {
  MediaAsset,
  MEDIA_MAX_CAPTION_CHARS,
  type CreateMediaAssetInput,
  type MediaAssetPersistenceRow,
  type MediaStatus,
} from '../src/modules/media/domain/media-asset.entity';

const VALID: CreateMediaAssetInput = {
  ownerId: 'user_alice',
  tripId: 'trip_1',
  kind: 'image',
  s3KeyRaw: 'user_alice/abc/def',
};

function expectInvalid(input: CreateMediaAssetInput, code: string): void {
  try {
    MediaAsset.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected MediaAsset.create() to throw ${code}, but it succeeded`);
}

describe('MediaAsset.create() (unit — domain invariants)', () => {
  it('happy path returns the input untouched', () => {
    expect(MediaAsset.create(VALID)).toEqual(VALID);
  });

  it('M1 rejects empty ownerId / s3KeyRaw', () => {
    expectInvalid({ ...VALID, ownerId: '' }, 'INVALID_MEDIA_ASSET');
    expectInvalid({ ...VALID, s3KeyRaw: '' }, 'INVALID_MEDIA_ASSET');
  });

  it('M2 rejects an unknown kind', () => {
    expectInvalid({ ...VALID, kind: 'audio' as 'image' }, 'INVALID_MEDIA_ASSET');
  });

  it('M2 accepts both legal kinds', () => {
    expect(MediaAsset.create({ ...VALID, kind: 'image' }).kind).toBe('image');
    expect(MediaAsset.create({ ...VALID, kind: 'video' }).kind).toBe('video');
  });
});

describe('MediaAsset.normaliseCaption()', () => {
  it('null / undefined / blank → null', () => {
    expect(MediaAsset.normaliseCaption(null)).toBeNull();
    expect(MediaAsset.normaliseCaption(undefined)).toBeNull();
    expect(MediaAsset.normaliseCaption('   ')).toBeNull();
  });

  it('trims and returns a non-empty value', () => {
    expect(MediaAsset.normaliseCaption('  hi  ')).toBe('hi');
  });

  it(`caps at ${MEDIA_MAX_CAPTION_CHARS} chars by slice (forgiving)`, () => {
    const long = 'x'.repeat(MEDIA_MAX_CAPTION_CHARS + 50);
    expect(MediaAsset.normaliseCaption(long)?.length).toBe(MEDIA_MAX_CAPTION_CHARS);
  });
});

describe('MediaAsset.assertCanMarkReady()', () => {
  function asset(status: MediaStatus): MediaAsset {
    const row: MediaAssetPersistenceRow = {
      id: 'media_1',
      ownerId: 'user_alice',
      tripId: null,
      memoryBookId: null,
      kind: 'image',
      status,
      s3KeyRaw: 'user_alice/x/y',
      exifStripped: false,
      caption: null,
      position: 0,
      variants: null,
      createdAt: new Date(),
    };
    return MediaAsset.fromPersistence(row);
  }

  it('passes for processing', () => {
    expect(() => MediaAsset.assertCanMarkReady(asset('processing'))).not.toThrow();
  });

  it('throws MEDIA_STATUS_LOCKED for ready', () => {
    try {
      MediaAsset.assertCanMarkReady(asset('ready'));
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).code).toBe('MEDIA_STATUS_LOCKED');
      return;
    }
    throw new Error('expected to throw');
  });

  it('throws MEDIA_STATUS_LOCKED for failed', () => {
    expect(() => MediaAsset.assertCanMarkReady(asset('failed'))).toThrow(ConflictError);
  });
});

describe('MediaAsset.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const a = MediaAsset.fromPersistence({
      id: 'media_1',
      ownerId: 'user_alice',
      tripId: null,
      memoryBookId: null,
      kind: 'image',
      status: 'ready',
      s3KeyRaw: 'user_alice/x/y',
      exifStripped: true,
      caption: 'cool shot',
      position: 0,
      variants: null,
      createdAt: new Date('2026-05-24'),
    });
    expect(a).toBeInstanceOf(MediaAsset);
    expect(a.exifStripped).toBe(true);
  });
});
