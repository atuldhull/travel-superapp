/**
 * Backup-code plaintext generator + hash helper.
 *
 * Plaintext shape: 8 characters from a 32-character no-ambiguity
 * alphabet (A-Z + 2-9 minus O/I/1/0 + B/G/Q confusables are kept
 * because the authenticator-font tradeoff makes them legible
 * enough). 32^8 ≈ 1.1 × 10¹² combinations → 40 bits of entropy.
 * At 10 codes per user that's <10⁻¹¹ collision odds across the
 * entire user base, which is plenty.
 *
 * Hashing: sha256(BACKUP_CODE_PEPPER + plaintext). Fast — high-
 * entropy codes don't need the argon2 cost factor that passwords
 * do. The pepper makes a DB dump useless without the env secret.
 *
 * Installed by prompt [III.13.2] part 5.
 */
import { createHash, randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no O/I/1/0.
const DEFAULT_LENGTH = 8;

export function generatePlaintextCode(length = DEFAULT_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

export function isWellFormedBackupCode(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${DEFAULT_LENGTH}}$`).test(code);
}

function getPepper(): string {
  const pepper = process.env.BACKUP_CODE_PEPPER;
  if (!pepper) {
    throw new Error('BACKUP_CODE_PEPPER env var missing at backup-code-hash time');
  }
  return pepper;
}

export function hashBackupCode(plaintext: string): string {
  return createHash('sha256')
    .update(getPepper() + plaintext.trim().toUpperCase(), 'utf8')
    .digest('hex');
}
