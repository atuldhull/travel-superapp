/**
 * Port for persistent JWT keyring state. The JwtTokenService used to
 * construct its keyring once at module init from the two env
 * secrets; that made rotation impossible without a full deploy.
 *
 * This port abstracts "where the current + previous keys live" so
 * the in-monolith v1 can back it with Redis (ephemeral, fine for
 * HS256 symmetric keys) and a future prod swap to RS256 + KMS can
 * back it without touching consumers.
 *
 *   - `getRing(name)` — resolves the current keyring for the ring.
 *     First-ever call in a fresh environment MUST hydrate from the
 *     env secret so the running app never 500s on its first
 *     sign/verify.
 *   - `rotate(name)` — push `current` → `previous`, mint a fresh
 *     32-byte secret with a new kid, persist. Returns the resulting
 *     keyring so the caller can log what happened.
 *
 * `RingName` values mirror the two token classes we mint. Adding a
 * third (e.g. `shared-secrets` for feature flags) would extend both
 * the enum + the store adapter — no use-case / controller churn.
 *
 * Installed by prompt [III.13.2.8].
 */
import type { JwtKeyring } from '@app/auth';

export type RingName = 'access' | 'refresh';

export interface JwtKeyringStore {
  /** Return the current keyring for `name`, hydrating from env on
   *  first boot. Subsequent calls within the process SHOULD serve
   *  from a short-TTL in-memory cache. */
  getRing(name: RingName): Promise<JwtKeyring>;
  /** Push current → previous, mint + persist a new current key.
   *  Returns the post-rotation ring. */
  rotate(name: RingName): Promise<JwtKeyring>;
  /** Expose every kid currently in either ring — used by the
   *  (future) JWKS-style public endpoint. Safe to call frequently;
   *  backs the read via the same cache as `getRing`. */
  listKids(): Promise<{ access: readonly string[]; refresh: readonly string[] }>;
}

export const JWT_KEYRING_STORE = Symbol('JwtKeyringStore');
