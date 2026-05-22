/**
 * Port for TOTP (RFC 6238) MFA operations.
 *
 * The application layer depends on this interface; the concrete
 * `TotpService` (infrastructure) wraps `speakeasy` and implements
 * it. Keeps use-cases free of any framework / 3rd-party-lib import
 * and makes the TOTP library swappable (CLAUDE.md #10).
 *
 * Extracted by prompt [A1-burndown].
 */

/** A freshly generated TOTP secret + its provisioning URI. */
export interface TotpSecret {
  readonly base32: string;
  readonly otpauthUri: string;
}

export interface TotpPort {
  /** Generate a fresh secret + the otpauth:// URI for QR display. */
  generateSecret(label: string, issuer?: string): TotpSecret;
  /** Verify a 6-digit code against a base32 secret (±1 step window).
   *  Never throws on a malformed code — returns false. */
  verifyCode(base32Secret: string, code: string): boolean;
}

/** Nest DI token. */
export const TOTP_PORT = Symbol('TotpPort');
