/**
 * Unit tests for `AgentProfile.validateUpdate()` + fromPersistence() —
 * pure domain test, no DB / Nest / mocks ([G4.2]).
 */
import { ValidationError } from '@app/errors';
import {
  AgentProfile,
  AGENT_MAX_BIO_CHARS,
  AGENT_MAX_DISPLAY_CHARS,
  AGENT_MAX_ENTRY_CHARS,
  AGENT_MAX_LIST,
  type AgentProfileUpdateInput,
} from '../src/modules/safety/domain/agent-profile.entity';

function expectInvalid(input: AgentProfileUpdateInput, code: string): void {
  try {
    AgentProfile.validateUpdate(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected AgentProfile.validateUpdate() to throw ${code}, but it succeeded`);
}

describe('AgentProfile.validateUpdate() (unit — domain invariants)', () => {
  it('empty input → empty patch (no field is "updated")', () => {
    expect(AgentProfile.validateUpdate({})).toEqual({});
  });

  it('happy path trims every present string field', () => {
    const patch = AgentProfile.validateUpdate({
      displayName: '  Alice  ',
      bio: '  hi  ',
      languages: ['  en  ', '  fr  '],
      regions: ['  paris  '],
    });
    expect(patch).toEqual({
      displayName: 'Alice',
      bio: 'hi',
      languages: ['en', 'fr'],
      regions: ['paris'],
    });
  });

  it('bio: null clears (passes through)', () => {
    expect(AgentProfile.validateUpdate({ bio: null })).toEqual({ bio: null });
  });

  it('A1 rejects an empty / overlong displayName', () => {
    expectInvalid({ displayName: '' }, 'INVALID_AGENT_DISPLAY_NAME');
    expectInvalid({ displayName: '   ' }, 'INVALID_AGENT_DISPLAY_NAME');
    expectInvalid(
      { displayName: 'x'.repeat(AGENT_MAX_DISPLAY_CHARS + 1) },
      'INVALID_AGENT_DISPLAY_NAME',
    );
  });

  it(`A2 rejects a bio longer than ${AGENT_MAX_BIO_CHARS} chars`, () => {
    expectInvalid({ bio: 'x'.repeat(AGENT_MAX_BIO_CHARS + 1) }, 'INVALID_AGENT_BIO');
  });

  it(`A3 rejects > ${AGENT_MAX_LIST} languages`, () => {
    expectInvalid({ languages: Array(AGENT_MAX_LIST + 1).fill('en') }, 'INVALID_AGENT_LIST');
  });

  it('A3 rejects an out-of-range language entry', () => {
    expectInvalid({ languages: ['x'] }, 'INVALID_AGENT_LIST'); // < 2 chars
    expectInvalid({ languages: ['x'.repeat(AGENT_MAX_ENTRY_CHARS + 1)] }, 'INVALID_AGENT_LIST');
  });

  it('A4 rejects > AGENT_MAX_LIST regions / out-of-range entries', () => {
    expectInvalid({ regions: Array(AGENT_MAX_LIST + 1).fill('eu') }, 'INVALID_AGENT_LIST');
    expectInvalid({ regions: ['x'] }, 'INVALID_AGENT_LIST');
  });
});

describe('AgentProfile.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const p = AgentProfile.fromPersistence({
      id: 'agent_1',
      userId: 'user_alice',
      displayName: 'Alice',
      bio: 'guide in Paris',
      kycStatus: 'verified',
      verifiedAt: new Date('2026-05-01'),
      languages: ['en', 'fr'],
      regions: ['paris'],
      ratingAverage: 4.8,
      ratingCount: 32,
      createdAt: new Date('2026-04-01'),
      updatedAt: new Date('2026-05-20'),
    });
    expect(p).toBeInstanceOf(AgentProfile);
    expect(p.kycStatus).toBe('verified');
    expect(p.ratingCount).toBe(32);
  });
});
