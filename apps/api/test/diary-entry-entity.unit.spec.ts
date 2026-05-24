/**
 * Unit tests for `DiaryEntry.create()` — pure domain test, no DB /
 * Nest / mocks ([G4.4]).
 */
import { ValidationError } from '@app/errors';
import {
  DiaryEntry,
  DIARY_MAX_TITLE,
  DIARY_MAX_BODY,
  DIARY_MAX_MOOD,
  type CreateDiaryEntryInput,
} from '../src/modules/diary/domain/diary-entry.entity';

const VALID: CreateDiaryEntryInput = {
  userId: 'user_alice',
  title: 'Day 1',
  body: 'Walked the seine.',
  mood: 'happy',
  entryDate: '2026-05-24',
};

function expectInvalid(input: CreateDiaryEntryInput, code: string): void {
  try {
    DiaryEntry.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected DiaryEntry.create() to throw ${code}, but it succeeded`);
}

describe('DiaryEntry.create() (unit — domain invariants)', () => {
  it('happy path normalises title/body, defaults aiAssisted=false, parses entryDate', () => {
    const out = DiaryEntry.create({ ...VALID, title: '  Day 1  ', body: '  text  ' });
    expect(out.title).toBe('Day 1');
    expect(out.body).toBe('text');
    expect(out.aiAssisted).toBe(false);
    expect(out.entryDate.toISOString().startsWith('2026-05-24')).toBe(true);
    expect(out.tripId).toBeNull();
  });

  it('defaults entryDate to "now" when omitted', () => {
    const { entryDate: _e, ...rest } = VALID;
    void _e;
    const before = Date.now();
    const out = DiaryEntry.create(rest);
    expect(out.entryDate.getTime()).toBeGreaterThanOrEqual(before - 1);
  });

  it('empty/whitespace mood collapses to null', () => {
    expect(DiaryEntry.create({ ...VALID, mood: '   ' }).mood).toBeNull();
    expect(DiaryEntry.create({ ...VALID, mood: null }).mood).toBeNull();
  });

  it('D1 rejects empty / overlong title', () => {
    expectInvalid({ ...VALID, title: '' }, 'INVALID_DIARY_TITLE');
    expectInvalid({ ...VALID, title: '   ' }, 'INVALID_DIARY_TITLE');
    expectInvalid({ ...VALID, title: 'x'.repeat(DIARY_MAX_TITLE + 1) }, 'INVALID_DIARY_TITLE');
  });

  it('D2 rejects empty / overlong body', () => {
    expectInvalid({ ...VALID, body: '' }, 'INVALID_DIARY_BODY');
    expectInvalid({ ...VALID, body: 'x'.repeat(DIARY_MAX_BODY + 1) }, 'INVALID_DIARY_BODY');
  });

  it(`D3 rejects mood > ${DIARY_MAX_MOOD} chars`, () => {
    expectInvalid({ ...VALID, mood: 'x'.repeat(DIARY_MAX_MOOD + 1) }, 'INVALID_DIARY_MOOD');
  });

  it('D4 rejects an unparseable entryDate', () => {
    expectInvalid({ ...VALID, entryDate: 'not-a-date' }, 'INVALID_DIARY_DATE');
  });
});

describe('DiaryEntry.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const e = DiaryEntry.fromPersistence({
      id: 'de_1',
      userId: 'user_alice',
      tripId: null,
      title: 'Day 1',
      body: 'Walked the seine.',
      mood: 'happy',
      aiAssisted: false,
      entryDate: new Date('2026-05-24'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(e).toBeInstanceOf(DiaryEntry);
    expect(e.aiAssisted).toBe(false);
  });
});
