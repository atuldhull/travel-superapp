/**
 * Vitest specs for AE322 formatChecklistAsBullets.
 */
import { describe, expect, it } from 'vitest';
import { formatChecklistAsBullets } from '../../src/components/aether/journey/format-checklist-bullets';

const mk = (id: string, text: string, done = false) => ({ id, text, done });

describe('formatChecklistAsBullets', () => {
  it('empty list → empty string', () => {
    expect(formatChecklistAsBullets([])).toBe('');
  });

  it('all undone use the • prefix', () => {
    expect(formatChecklistAsBullets([mk('1', 'Passport'), mk('2', 'Cash')])).toBe(
      '• Passport\n• Cash',
    );
  });

  it('all done use the ✓ prefix', () => {
    expect(formatChecklistAsBullets([mk('1', 'Bag', true), mk('2', 'Map', true)])).toBe(
      '✓ Bag\n✓ Map',
    );
  });

  it('mixed states render in input order', () => {
    expect(
      formatChecklistAsBullets([mk('1', 'Visa', true), mk('2', 'Jacket'), mk('3', 'ID', true)]),
    ).toBe('✓ Visa\n• Jacket\n✓ ID');
  });

  it('preserves whitespace + unicode in text verbatim', () => {
    expect(formatChecklistAsBullets([mk('1', '  Diamox 💊  '), mk('2', 'पासपोर्ट')])).toBe(
      '•   Diamox 💊  \n• पासपोर्ट',
    );
  });

  it('single item — no trailing newline', () => {
    expect(formatChecklistAsBullets([mk('1', 'Solo')])).toBe('• Solo');
    expect(formatChecklistAsBullets([mk('1', 'Solo', true)])).toBe('✓ Solo');
  });
});
