/**
 * Email hashing helper shared between register + login. Uses the
 * `EMAIL_PEPPER` env var (Playbook §13.11) to make rainbow-table
 * attacks on the hash column useless — even if the DB is exfiltrated,
 * an attacker needs the pepper to pre-compute matches.
 *
 * Module-scoped cache of the pepper is intentional: `validateEnv`
 * runs at process start, so `process.env.EMAIL_PEPPER` is stable.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { createHash } from 'node:crypto';

function getPepper(): string {
  const pepper = process.env.EMAIL_PEPPER;
  if (!pepper) {
    // Should never happen — @app/config fails fast at bootstrap. Belt
    // for code paths invoked before Nest has started (ex: test setup).
    throw new Error('EMAIL_PEPPER env var missing at email-hash time');
  }
  return pepper;
}

export function hashEmail(emailLower: string): string {
  return createHash('sha256')
    .update(getPepper() + emailLower, 'utf8')
    .digest('hex');
}
