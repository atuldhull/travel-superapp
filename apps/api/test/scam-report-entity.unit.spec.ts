/**
 * Unit tests for `ScamReport.create()` — pure domain test, no DB /
 * Nest / mocks. One test per invariant ([G4.2]).
 */
import { ValidationError } from '@app/errors';
import {
  ScamReport,
  SCAM_MAX_CATEGORY_LENGTH,
  SCAM_MAX_DESCRIPTION_LENGTH,
  SCAM_MAX_EVIDENCE_URLS,
  SCAM_MAX_URL_LENGTH,
  type CreateScamReportInput,
} from '../src/modules/safety/domain/scam-report.entity';

const VALID: CreateScamReportInput = {
  reporterId: 'user_alice',
  category: 'taxi-overcharge',
  severity: 'medium',
  description: 'Driver demanded triple the meter and refused change.',
  evidenceUrls: ['https://imgur.example/a.jpg'],
};

function expectInvalid(input: CreateScamReportInput, code: string): void {
  try {
    ScamReport.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ScamReport.create() to throw ${code}, but it succeeded`);
}

describe('ScamReport.create() (unit — domain invariants)', () => {
  it('happy path returns the input with category/description trimmed', () => {
    const out = ScamReport.create({
      ...VALID,
      category: '  taxi-overcharge  ',
      description: '  spaces around  ',
    });
    expect(out.category).toBe('taxi-overcharge');
    expect(out.description).toBe('spaces around');
  });

  it('S1 rejects empty reporterId', () => {
    expectInvalid({ ...VALID, reporterId: '' }, 'INVALID_SCAM_REPORT');
  });

  it('S2 rejects empty / overlong category', () => {
    expectInvalid({ ...VALID, category: '' }, 'INVALID_SCAM_REPORT');
    expectInvalid({ ...VALID, category: '   ' }, 'INVALID_SCAM_REPORT');
    expectInvalid(
      { ...VALID, category: 'x'.repeat(SCAM_MAX_CATEGORY_LENGTH + 1) },
      'INVALID_SCAM_REPORT',
    );
  });

  it('S3 rejects an unknown severity', () => {
    expectInvalid({ ...VALID, severity: 'fatal' as 'high' }, 'INVALID_SCAM_REPORT');
  });

  it('S3 accepts each legal severity', () => {
    for (const sev of ['low', 'medium', 'high', 'critical'] as const) {
      expect(ScamReport.create({ ...VALID, severity: sev }).severity).toBe(sev);
    }
  });

  it('S4 rejects empty / overlong description', () => {
    expectInvalid({ ...VALID, description: '' }, 'INVALID_SCAM_REPORT');
    expectInvalid({ ...VALID, description: '   ' }, 'INVALID_SCAM_REPORT');
    expectInvalid(
      { ...VALID, description: 'x'.repeat(SCAM_MAX_DESCRIPTION_LENGTH + 1) },
      'INVALID_SCAM_REPORT',
    );
  });

  it(`S5 rejects > ${SCAM_MAX_EVIDENCE_URLS} evidence URLs`, () => {
    expectInvalid(
      { ...VALID, evidenceUrls: Array(SCAM_MAX_EVIDENCE_URLS + 1).fill('https://x.example/a.jpg') },
      'INVALID_SCAM_REPORT',
    );
  });

  it('S5 rejects an empty or overlong evidence URL entry', () => {
    expectInvalid({ ...VALID, evidenceUrls: [''] }, 'INVALID_SCAM_REPORT');
    expectInvalid(
      { ...VALID, evidenceUrls: ['x'.repeat(SCAM_MAX_URL_LENGTH + 1)] },
      'INVALID_SCAM_REPORT',
    );
  });

  it('omitted evidenceUrls is OK', () => {
    const { evidenceUrls: _unused, ...rest } = VALID;
    void _unused;
    const out = ScamReport.create(rest);
    expect(out.evidenceUrls).toBeUndefined();
  });
});

describe('ScamReport.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const r = ScamReport.fromPersistence({
      id: 'scam_1',
      reporterId: 'user_alice',
      category: 'taxi-overcharge',
      severity: 'medium',
      description: 'demanded triple',
      evidenceUrls: ['https://x'],
      verified: false,
      createdAt: new Date('2026-05-24T00:00:00Z'),
      updatedAt: new Date('2026-05-24T00:00:00Z'),
    });
    expect(r).toBeInstanceOf(ScamReport);
    expect(r.severity).toBe('medium');
    expect(r.verified).toBe(false);
  });
});
