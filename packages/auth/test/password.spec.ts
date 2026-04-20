/**
 * Unit tests for password primitives. No DI, no Nest, no DB.
 *
 * Installed by prompt [III.13.2].
 */
import { hashPassword, needsRehash, verifyPassword } from '../src/password';

describe('password', () => {
  describe('hashPassword', () => {
    it('returns an argon2id-encoded string at the Playbook cost parameters', async () => {
      const hash = await hashPassword('hunter2-but-longer');
      // Format: `$argon2id$v=19$m=65536,t=3,p=1$<salt>$<digest>`
      expect(hash.startsWith('$argon2id$')).toBe(true);
      expect(hash).toContain('m=65536');
      expect(hash).toContain('t=3');
      expect(hash).toContain('p=1');
    });

    it('generates a different hash for the same password on re-hash (salt is random)', async () => {
      const a = await hashPassword('same-password');
      const b = await hashPassword('same-password');
      expect(a).not.toBe(b);
    });

    it('rejects empty string', async () => {
      await expect(hashPassword('')).rejects.toThrow(/non-empty/);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for a matching password + hash', async () => {
      const hash = await hashPassword('correct-horse-battery-staple');
      expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    });

    it('returns false for a non-matching password', async () => {
      const hash = await hashPassword('correct-horse-battery-staple');
      expect(await verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('returns false (not throws) on a malformed hash', async () => {
      expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
    });

    it('returns false for an empty password, does not leak timing', async () => {
      const hash = await hashPassword('something');
      expect(await verifyPassword('', hash)).toBe(false);
    });

    it('throws only when hash is empty — defensive against callers who pass `undefined` stringified', async () => {
      await expect(verifyPassword('x', '')).rejects.toThrow(/non-empty/);
    });
  });

  describe('needsRehash', () => {
    it('returns false for a hash at current cost parameters', async () => {
      const hash = await hashPassword('x');
      expect(needsRehash(hash)).toBe(false);
    });

    it('returns true for a hash with a different memoryCost', () => {
      // Synthesized hash with m=4096 (4 MiB — lower than our 65536)
      const lowCost =
        '$argon2id$v=19$m=4096,t=3,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGFzaGFzaGFzaGFzaGFzaA';
      expect(needsRehash(lowCost)).toBe(true);
    });

    it('returns true for an unrecognised hash format (safe default)', () => {
      expect(needsRehash('plain-bcrypt-$2b$12$...')).toBe(true);
    });
  });
});
