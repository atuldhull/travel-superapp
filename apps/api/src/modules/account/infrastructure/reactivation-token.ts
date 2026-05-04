/**
 * V.UX.33 — stateless HMAC token for the account-reactivation flow.
 * Format: base64url(`${userId}|${expiresAtMs}|${hex(hmac)}`).
 *
 * Why HMAC + no DB row: the natural single-use semantics come from
 * the side effect — once `restoreUser` clears `User.deletedAt`,
 * subsequent reactivate attempts find an already-active row and
 * the use-case returns the same success shape (idempotent).
 *
 * The pepper is `EMAIL_PEPPER` (already required by the env schema)
 * — same secret the magic-link + password-reset hashes use. Rotating
 * the pepper invalidates every outstanding reactivation token,
 * which is the right posture for a security-critical secret.
 *
 * Installed by prompt [V.UX.33].
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // matches the soft-delete retention window

export function mintReactivationToken(
  userId: string,
  pepper: string,
  now: Date = new Date(),
): string {
  const expiresAt = now.getTime() + TTL_MS;
  const payload = `${userId}|${expiresAt}`;
  const hmac = createHmac('sha256', pepper).update(payload).digest('hex');
  return Buffer.from(`${payload}|${hmac}`, 'utf8').toString('base64url');
}

export interface VerifiedReactivationToken {
  readonly userId: string;
  readonly expiresAt: Date;
}

export function verifyReactivationToken(
  token: string,
  pepper: string,
  now: Date = new Date(),
): VerifiedReactivationToken | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const parts = decoded.split('|');
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, hmacHex] = parts;
  if (!userId || !expiresAtStr || !hmacHex) return null;
  const expiresAtMs = Number(expiresAtStr);
  if (!Number.isFinite(expiresAtMs)) return null;
  if (now.getTime() >= expiresAtMs) return null;
  const expected = createHmac('sha256', pepper).update(`${userId}|${expiresAtStr}`).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(hmacHex, 'hex');
  } catch {
    return null;
  }
  if (actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;
  return { userId, expiresAt: new Date(expiresAtMs) };
}
