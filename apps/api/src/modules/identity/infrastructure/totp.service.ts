/**
 * TOTP (RFC 6238) service for MFA — wraps `speakeasy` so the rest
 * of the identity module doesn't import it directly. This keeps the
 * concrete library swappable and the application layer clean of
 * framework imports.
 *
 * Parameters follow RFC 6238 defaults + Playbook §13.2:
 *   - SHA1 algorithm (universal authenticator-app support — Google
 *     Authenticator, Authy, 1Password, Aegis, Raivo all speak SHA1.
 *     SHA256/SHA512 exist but break ~30% of real-world apps).
 *   - 30-second step.
 *   - 6-digit code.
 *   - Window of ±1 step (~90s total tolerance) to survive small
 *     clock drift without widening the replay surface.
 *
 * The raw `base32` secret is what we persist. The `otpauth_url`
 * (RFC 6238 provisioning URI) is what we hand to the client for QR
 * rendering — the client's authenticator app scans the QR + the
 * user's phone starts generating codes.
 *
 * Installed by prompt [III.13.2] part 4.
 */
import { Injectable } from '@nestjs/common';
import speakeasy from 'speakeasy';
import type { TotpPort, TotpSecret } from '../application/ports/totp.port';

@Injectable()
export class TotpService implements TotpPort {
  /**
   * Generate a fresh TOTP secret and the otpauth:// URI to show to
   * the user (as a QR code). `label` is the account identifier
   * shown in the authenticator app; `issuer` is the product name.
   */
  generateSecret(label: string, issuer = 'TravelSuperApp'): TotpSecret {
    const secret = speakeasy.generateSecret({
      name: `${issuer}:${label}`,
      issuer,
      length: 20, // 20 bytes = 160 bits of entropy; standard RFC 6238.
    });
    if (!secret.base32 || !secret.otpauth_url) {
      // speakeasy's types allow undefined; in practice both are set.
      throw new Error('speakeasy.generateSecret returned incomplete secret');
    }
    return { base32: secret.base32, otpauthUri: secret.otpauth_url };
  }

  /**
   * Check a 6-digit code against a stored base32 secret. Accepts a
   * ±1 time-step window (~90s). Returns `true` only on a verified
   * match; never throws on a malformed code — callers decide how
   * to surface it.
   */
  verifyCode(base32Secret: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    return speakeasy.totp.verify({
      secret: base32Secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
  }
}
