# Security policy

## Reporting a vulnerability

We take security reports seriously. **Please do not file public
issues for security bugs.**

- **Email:** `security@<our-domain>` (set up before first public launch)
- **Encrypted:** GPG key fingerprint published alongside the inbox.
- **Response SLA:**
  - Acknowledged within **48 hours** (business days)
  - Triaged + severity assigned within **7 days**
  - Patch + disclosure timeline within **30 days** for high/critical

We follow [coordinated disclosure](https://about.gitlab.com/handbook/engineering/security/disclosure-policy/):
report → we patch → public CVE / advisory after the fix is widely
deployed (or 90 days, whichever is sooner).

## Scope

In-scope:

- `apps/api` — Fastify+NestJS backend
- `apps/web` — Next.js 15 frontend
- `apps/mobile` (when shipped) — Expo React Native
- The CI/CD chain (`.github/workflows/`)
- Infrastructure-as-code under `ops/terraform/`

Out-of-scope:

- Third-party services we integrate with (Supabase, Cloudflare,
  Anthropic, etc.) — please report directly to the vendor.
- Local dev tooling (Doppler, Docker compose configs) unless the
  vulnerability also impacts a deployed environment.
- Social-engineering / physical-access attacks.

## Supported versions

We support the **latest tagged release** + the prior minor version
during a 14-day overlap window after a new minor ships. Older
versions get security fixes only on a best-effort basis.

## What you'll get

- Public credit in the release notes + the security advisory (opt-in;
  anonymous reports honored).
- A direct line to the eng team during the fix.
- For severe issues: a swag / bounty negotiated case-by-case until
  a formal bug-bounty program launches.

## What we ship today (for context)

Documented in [`docs/security/threat-model.md`](docs/security/threat-model.md):

- STRIDE-per-hop trust-boundary analysis
- Top-10 abuse scenarios + current mitigation status
- Defense-in-depth inventory (helmet, throttler, lockout, MFA,
  JWT key rotation, peppering, audit log, etc.)
- Threats we knowingly accept + rationale

CI gates currently in place:

- `pnpm audit:critical` blocks merge on any critical CVE
- Semgrep SAST (OWASP top-ten + nodejsscan + typescript)
- OWASP ZAP DAST (informational; runs nightly)
- Dependabot weekly + security-advisory immediate PRs

## Out-of-band contacts

If `security@` is unreachable for any reason (compromised email,
DNS failure, vendor incident), open a low-detail GitHub issue
titled "Security contact request" — we'll respond with an
alternative channel.
