/**
 * Unit tests for `SosEvent.create()` + normaliseResolutionNote() —
 * pure domain test, no DB / Nest / mocks ([G4.2]).
 */
import { ValidationError } from '@app/errors';
import {
  SosEvent,
  SOS_MAX_TRIGGER_LENGTH,
  SOS_MAX_RESOLUTION_NOTE_LENGTH,
  type CreateSosEventInput,
} from '../src/modules/safety/domain/sos-event.entity';

const VALID: CreateSosEventInput = { userId: 'user_alice', trigger: 'manual_tap' };

function expectInvalid(input: CreateSosEventInput, code: string): void {
  try {
    SosEvent.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected SosEvent.create() to throw ${code}, but it succeeded`);
}

describe('SosEvent.create() (unit — domain invariants)', () => {
  it('happy path returns the input with trigger trimmed', () => {
    expect(SosEvent.create({ ...VALID, trigger: '  manual_tap  ' })).toEqual({
      userId: 'user_alice',
      trigger: 'manual_tap',
    });
  });

  it('O1 rejects an empty userId', () => {
    expectInvalid({ ...VALID, userId: '' }, 'INVALID_SOS_EVENT');
  });

  it('O2 rejects an empty / overlong trigger', () => {
    expectInvalid({ ...VALID, trigger: '' }, 'INVALID_SOS_EVENT');
    expectInvalid({ ...VALID, trigger: '   ' }, 'INVALID_SOS_EVENT');
    expectInvalid(
      { ...VALID, trigger: 'x'.repeat(SOS_MAX_TRIGGER_LENGTH + 1) },
      'INVALID_SOS_EVENT',
    );
  });
});

describe('SosEvent.normaliseResolutionNote() (unit)', () => {
  it('null / undefined / empty-after-trim → null', () => {
    expect(SosEvent.normaliseResolutionNote(null)).toBeNull();
    expect(SosEvent.normaliseResolutionNote(undefined)).toBeNull();
    expect(SosEvent.normaliseResolutionNote('   ')).toBeNull();
  });

  it('trims and returns a non-empty note', () => {
    expect(SosEvent.normaliseResolutionNote('  ok  ')).toBe('ok');
  });

  it(`rejects a note longer than ${SOS_MAX_RESOLUTION_NOTE_LENGTH} chars`, () => {
    expect(() =>
      SosEvent.normaliseResolutionNote('x'.repeat(SOS_MAX_RESOLUTION_NOTE_LENGTH + 1)),
    ).toThrow(ValidationError);
  });
});

describe('SosEvent.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const e = SosEvent.fromPersistence({
      id: 'sos_1',
      userId: 'user_alice',
      trigger: 'manual_tap',
      resolvedAt: null,
      resolutionNote: null,
      createdAt: new Date('2026-05-24T00:00:00Z'),
    });
    expect(e).toBeInstanceOf(SosEvent);
    expect(e.resolvedAt).toBeNull();
  });
});
