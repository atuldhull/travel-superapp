/**
 * Unit tests for `TrustedContact.create()` — pure domain test, no DB /
 * Nest / mocks ([G4.3]).
 */
import { ValidationError } from '@app/errors';
import {
  TrustedContact,
  TRUSTED_CONTACT_MAX_NAME_CHARS,
  TRUSTED_CONTACT_MAX_PHONE_CHARS,
  TRUSTED_CONTACT_MAX_EMAIL_CHARS,
  type CreateTrustedContactInput,
} from '../src/modules/account/domain/trusted-contact.entity';

const VALID: CreateTrustedContactInput = {
  userId: 'user_alice',
  name: 'Alice Mom',
  phone: '+15551234567',
  email: 'mom@example.com',
};

function expectInvalid(input: CreateTrustedContactInput, code: string): void {
  try {
    TrustedContact.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected TrustedContact.create() to throw ${code}, but it succeeded`);
}

describe('TrustedContact.create() (unit — domain invariants)', () => {
  it('happy path returns trimmed name + non-null channels', () => {
    expect(TrustedContact.create({ ...VALID, name: '  Alice Mom  ' })).toEqual({
      userId: 'user_alice',
      name: 'Alice Mom',
      phone: '+15551234567',
      email: 'mom@example.com',
    });
  });

  it('phone-only is OK', () => {
    expect(TrustedContact.create({ ...VALID, email: null }).email).toBeNull();
  });

  it('email-only is OK', () => {
    expect(TrustedContact.create({ ...VALID, phone: null }).phone).toBeNull();
  });

  it('C1 rejects empty userId', () => {
    expectInvalid({ ...VALID, userId: '' }, 'INVALID_TRUSTED_CONTACT');
  });

  it('C2 rejects empty / overlong name', () => {
    expectInvalid({ ...VALID, name: '' }, 'INVALID_TRUSTED_CONTACT');
    expectInvalid({ ...VALID, name: '   ' }, 'INVALID_TRUSTED_CONTACT');
    expectInvalid(
      { ...VALID, name: 'x'.repeat(TRUSTED_CONTACT_MAX_NAME_CHARS + 1) },
      'INVALID_TRUSTED_CONTACT',
    );
  });

  it('C3 rejects channel-empty (no phone + no email)', () => {
    expectInvalid({ ...VALID, phone: null, email: null }, 'CONTACT_CHANNEL_REQUIRED');
    expectInvalid({ ...VALID, phone: '   ', email: '' }, 'CONTACT_CHANNEL_REQUIRED');
  });

  it(`C4 rejects a phone > ${TRUSTED_CONTACT_MAX_PHONE_CHARS} chars`, () => {
    expectInvalid(
      { ...VALID, phone: '+1' + '1'.repeat(TRUSTED_CONTACT_MAX_PHONE_CHARS) },
      'INVALID_TRUSTED_CONTACT',
    );
  });

  it(`C5 rejects a malformed / overlong email`, () => {
    expectInvalid({ ...VALID, email: 'not-an-email' }, 'INVALID_TRUSTED_CONTACT');
    expectInvalid(
      { ...VALID, email: 'x'.repeat(TRUSTED_CONTACT_MAX_EMAIL_CHARS - 4) + '@a.bcdef' },
      'INVALID_TRUSTED_CONTACT',
    );
  });
});

describe('TrustedContact.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const c = TrustedContact.fromPersistence({
      id: 'tc_1',
      userId: 'user_alice',
      name: 'Alice Mom',
      phone: '+15551234567',
      email: 'mom@example.com',
      createdAt: new Date('2026-05-24'),
      updatedAt: new Date('2026-05-24'),
    });
    expect(c).toBeInstanceOf(TrustedContact);
    expect(c.name).toBe('Alice Mom');
  });
});
