/**
 * Unit tests for `ItineraryItem.create()` — pure domain test, no DB /
 * Nest / mocks. Defense-in-depth invariants for a future
 * `GenerateItineraryUseCase` ([G4.4]).
 */
import { ValidationError } from '@app/errors';
import {
  ItineraryItem,
  ITINERARY_ITEM_MAX_NOTES_CHARS,
  type CreateItineraryItemInput,
} from '../src/modules/trip/domain/itinerary.entity';

const VALID: CreateItineraryItemInput = {
  dayId: 'day_1',
  position: 0,
  placeId: 'place_eiffel',
  notes: 'sunset light',
};

function expectInvalid(input: CreateItineraryItemInput, code: string): void {
  try {
    ItineraryItem.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ItineraryItem.create() to throw ${code}, but it succeeded`);
}

describe('ItineraryItem.create() (unit — domain invariants)', () => {
  it('happy path returns the input with notes trimmed', () => {
    const out = ItineraryItem.create({ ...VALID, notes: '   light   ' });
    expect(out.notes).toBe('light');
  });

  it('I1 rejects empty dayId', () => {
    expectInvalid({ ...VALID, dayId: '' }, 'INVALID_ITINERARY_ITEM');
  });

  it('I2 rejects negative / non-integer position', () => {
    expectInvalid({ ...VALID, position: -1 }, 'INVALID_ITINERARY_ITEM');
    expectInvalid({ ...VALID, position: 1.5 }, 'INVALID_ITINERARY_ITEM');
  });

  it(`I3 rejects notes longer than ${ITINERARY_ITEM_MAX_NOTES_CHARS} chars`, () => {
    expectInvalid(
      { ...VALID, notes: 'x'.repeat(ITINERARY_ITEM_MAX_NOTES_CHARS + 1) },
      'INVALID_ITINERARY_ITEM',
    );
  });

  it('empty / whitespace notes collapses to null', () => {
    expect(ItineraryItem.create({ ...VALID, notes: '   ' }).notes).toBeNull();
    expect(ItineraryItem.create({ ...VALID, notes: null }).notes).toBeNull();
  });

  it('I4 rejects startTime > endTime', () => {
    expectInvalid(
      {
        ...VALID,
        startTime: new Date('2026-05-24T10:00:00Z'),
        endTime: new Date('2026-05-24T09:00:00Z'),
      },
      'INVALID_ITINERARY_ITEM',
    );
  });

  it('I4 accepts startTime == endTime', () => {
    const t = new Date('2026-05-24T10:00:00Z');
    expect(() => ItineraryItem.create({ ...VALID, startTime: t, endTime: t })).not.toThrow();
  });
});

describe('ItineraryItem.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const it = ItineraryItem.fromPersistence({
      id: 'item_1',
      dayId: 'day_1',
      position: 0,
      placeId: 'place_eiffel',
      startTime: null,
      endTime: null,
      notes: 'sunset light',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });
    expect(it).toBeInstanceOf(ItineraryItem);
    expect(it.completedAt).toBeNull();
  });
});
