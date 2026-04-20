import argon2 from 'argon2';

/**
 * Password hashing + verification via argon2id.
 *
 * Parameters match Playbook §13.2 ("argon2id — timeCost: 3,
 * memoryCost: 65536"). Argon2's defaults are slightly different; we
 * override explicitly so every pod uses the same work factor and a
 * hash generated on pod A verifies correctly on pod B.
 *
 * These are pure async functions — no DI, no Nest, no state. Safe to
 * import from any layer; the Identity module's use-cases call them
 * directly.
 *
 * Installed by prompt [III.13.2] (foundation — `@app/auth` part 1).
 */

/**
 * Fixed argon2id parameters. If ANY of these change, every existing
 * hash in the DB becomes slower-but-still-valid to verify (argon2
 * encodes its params in the hash prefix) — argon2.verify() reads the
 * params from the hash itself. Upgrading later is a re-hash-on-login
 * migration, not a hash-format flag day.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 65_536, // 64 MiB
  parallelism: 1,
} as const;

/**
 * Hash a plaintext password. Returns the full argon2-encoded string:
 *   `$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>`
 * The salt is randomly generated per-hash by argon2 (16 bytes).
 *
 * The input MUST be a non-empty string (Zod the boundary before
 * calling here — this function assumes a validated input).
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('hashPassword: plaintext must be a non-empty string');
  }
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against a previously-stored hash.
 * Returns `true` on match, `false` otherwise. Never throws on a bad
 * password — throws only on malformed `hash` input.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (typeof plaintext !== 'string' || plaintext.length === 0) return false;
  if (typeof hash !== 'string' || hash.length === 0) {
    throw new Error('verifyPassword: hash must be a non-empty string');
  }
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    // argon2.verify throws on malformed hash strings — treat as
    // "does not match" rather than leaking implementation details.
    return false;
  }
}

/**
 * Should this hash be re-hashed with the current work factor?
 * Useful during credential-parameter bumps: when a user logs in
 * with an older-cost hash, verify it, then re-hash with today's
 * `ARGON2_OPTIONS` and save the new hash.
 */
export function needsRehash(hash: string): boolean {
  // argon2 encodes params as `m=NNNN,t=N,p=N`.
  const match = /\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(hash);
  if (!match) return true; // unrecognised — rehash just in case
  const m = Number(match[1]);
  const t = Number(match[2]);
  const p = Number(match[3]);
  return (
    m !== ARGON2_OPTIONS.memoryCost ||
    t !== ARGON2_OPTIONS.timeCost ||
    p !== ARGON2_OPTIONS.parallelism
  );
}
