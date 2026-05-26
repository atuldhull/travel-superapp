/**
 * Next.js middleware — admin-route IP allowlist enforcement.
 *
 * Closes E1 of the S-series E-block. The Z2 admin audit flagged the
 * ship-blocker: every logged-in admin currently reaches `/admin/*`
 * from anywhere on the public internet. Even though API-side
 * `@Roles('admin')` is airtight, surface-area minimisation by IP
 * is a defense-in-depth requirement before customer-facing launch.
 *
 * Behaviour:
 *
 * - If `ADMIN_IP_ALLOWLIST` is UNSET → no enforcement (with a one-time
 *   console.warn on the first matched path). Keeps dev frictionless.
 *
 * - If `ADMIN_IP_ALLOWLIST` is `*` → bypass (explicit acknowledgement
 *   that the operator wants the surface open — useful in staging).
 *
 * - If `ADMIN_IP_ALLOWLIST` is set to a CSV of literal IPv4 addresses
 *   or CIDR ranges (e.g. `203.0.113.5,198.51.100.0/24`) → only those
 *   IPs reach `/admin/*`; everything else returns 403.
 *
 * IP extraction: leftmost entry of `x-forwarded-for`, falling back to
 * `x-real-ip`, finally `request.ip` from Next.js. Vercel / Cloudflare
 * both populate `x-forwarded-for` with the original client IP first.
 *
 * IPv4 only for v1. IPv6 callers always 403 when allowlist is enforced
 * (an operator who needs IPv6 admin access must drop the allowlist or
 * upgrade this middleware). Honest about the limitation: it's the same
 * limitation as Cloudflare's `ip.src in {...}` rule before [N9]'s
 * IPv6-tested update.
 *
 * Installed by [S-E1] of the S-series real-functionality closeout.
 */
import { NextResponse, type NextRequest } from 'next/server';

export const config = {
  // Only gate the admin tree. The root-level matcher would also work
  // but adds 1-2ms per request to every page — the targeted matcher
  // is essentially free for non-admin traffic.
  matcher: ['/admin/:path*'],
};

let warnedAboutMissingEnv = false;

export function middleware(request: NextRequest): NextResponse {
  const raw = process.env.ADMIN_IP_ALLOWLIST;

  // Unset → development convenience. Warn once so the boot log makes
  // the open-surface obvious in staging / preview deploys.
  if (!raw || raw.trim().length === 0) {
    if (!warnedAboutMissingEnv) {
      // eslint-disable-next-line no-console -- middleware can't use @app/logger (Edge runtime)
      console.warn(
        '[admin-middleware] ADMIN_IP_ALLOWLIST is unset — /admin/* is open. Set it in production.',
      );
      warnedAboutMissingEnv = true;
    }
    return NextResponse.next();
  }

  // Explicit wildcard — operator-acknowledged open surface.
  if (raw.trim() === '*') {
    return NextResponse.next();
  }

  const allow = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const clientIp = extractClientIp(request);

  if (clientIp && allow.some((entry) => matchesEntry(clientIp, entry))) {
    return NextResponse.next();
  }

  // Block with a small body so legitimate users hitting a misconfig
  // can troubleshoot. NOT logging the offending IP to avoid leaking
  // info into the response; ops should look at edge logs.
  return new NextResponse(
    JSON.stringify({
      error: 'admin_ip_not_allowlisted',
      message: 'Your IP is not on the admin allowlist. Contact the operator.',
    }),
    {
      status: 403,
      headers: { 'content-type': 'application/json' },
    },
  );
}

function extractClientIp(request: NextRequest): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // Leftmost = original client (any subsequent entries are proxies).
    // Strip the port if present (some edges append :12345).
    const first = xff.split(',')[0]?.trim();
    if (first) return stripPort(first);
  }
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return stripPort(xRealIp.trim());
  // Next.js Edge runtime exposes `request.ip` on Vercel; undefined locally.
  const reqIp = (request as { ip?: string }).ip;
  return reqIp ? stripPort(reqIp) : null;
}

function stripPort(ip: string): string {
  // IPv4 + port → "1.2.3.4:5678". IPv6 won't match this naive pattern
  // (which is intentional — IPv6 is rejected below anyway).
  const m = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?$/);
  return m ? m[1]! : ip;
}

/** Match an IPv4 address against either a literal IP or a CIDR range. */
function matchesEntry(clientIp: string, entry: string): boolean {
  if (!isIpv4(clientIp)) return false; // IPv6 callers always miss (documented).
  if (entry.includes('/')) {
    return matchesCidr(clientIp, entry);
  }
  return isIpv4(entry) && clientIp === entry;
}

function isIpv4(s: string): boolean {
  const parts = s.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

function matchesCidr(clientIp: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/');
  if (!base || !bits || !isIpv4(base)) return false;
  const prefix = Number(bits);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const clientN = ipv4ToUint32(clientIp);
  const baseN = ipv4ToUint32(base);
  if (clientN === null || baseN === null) return false;
  if (prefix === 0) return true; // 0.0.0.0/0 matches everything.
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (clientN & mask) === (baseN & mask);
}

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}
