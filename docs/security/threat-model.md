# Threat model — TravelSuperApp

> **Status:** v1 (installed by [N7]).
> **Scope:** apps/api + apps/web + the trust boundaries between
> them and external services. Mobile (Expo) inherits the same
> threats; specifics live in `apps/mobile/THREAT-NOTES.md` once
> mobile ships.
> **Methodology:** STRIDE per data-flow, plus a "Top abuse scenarios"
> ranked by business impact.
> **Review cadence:** every 6 months, OR whenever a new external
> integration lands, OR after any incident.

## 1. Trust boundaries

```
                                        external
              ┌───────────────────────────────────────────────────────────┐
              │                                                           │
              ▼  ① browser / Expo app                                     │
       ┌────────────┐                                                     │
       │   Client   │ ── public HTTP, no shared secrets ──┐               │
       └─────┬──────┘                                     │               │
             │                                            ▼               │
             │                                  ┌─────────────────┐       │
             │  ② edge (Cloudflare / Fly LB)    │ Cloudflare /    │       │
             ├──────────────────────────────────│   Fly proxy     │       │
             │                                  └────────┬────────┘       │
             │                                            │               │
             │                                            ▼               │
             │                                  ┌─────────────────┐       │
             │  ③ apps/api (Fastify+Nest)       │   Fly machine   │       │
             ├──────────────────────────────────│   travel-api    │       │
             │                                  └────────┬────────┘       │
             │                                            │               │
             │                                            ▼               │
             │              ④ Postgres (Supabase)  ⑤ Redis (Upstash)  ⑥ R2 / S3
             │                                            │               │
             │                                            ▼               │
             │              ⑦ Anthropic / Gemini / OpenSky / Resend / Twilio / Stripe
             │                                                            │
             └────────────────────────────────────────────────────────────┘
                                       internal
```

Each numbered hop is a trust boundary — a place where the data
crossing it is from a less-trusted to a more-trusted (or different-
trusted) zone. The model below applies STRIDE per hop.

## 2. STRIDE per hop

| #   | Hop                                    | S (spoofing)                          | T (tampering)                                 | R (repudiation)                        | I (info disclosure)                              | D (DoS)                                        | E (elevation)                                                    |
| --- | -------------------------------------- | ------------------------------------- | --------------------------------------------- | -------------------------------------- | ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| ①   | Client → public Internet               | Stolen JWT, refresh-token replay      | Tampered Authorization header                 | "I didn't make that trip"              | XSS leaking session                              | Botnet flooding /auth/login                    | Self-grant admin via mass-assignment                             |
| ②   | Edge → api                             | Spoofed `X-Forwarded-For`; bypass WAF | TLS downgrade                                 | Edge logs say one IP, api says another | Cloudflare cache poisoning of authenticated page | Layer-7 DDoS                                   | Edge worker miscompile leaks admin cookies                       |
| ③   | api internal: zod → use-case → repo    | DTO trusts a field it shouldn't       | Prototype pollution via JSON                  | No audit trail on sensitive mutation   | Verbose error leaks internal path                | Unbounded SQL `like` query                     | Forgotten `@Roles` decorator on admin route                      |
| ④   | api → Postgres                         | Connection string leak                | SQL injection via raw query                   | Lost row history                       | `SELECT *` over a vector / hashed column         | `max_connections` exhaustion (FIXED via L3+L1) | Service role used where anon was sufficient                      |
| ⑤   | api → Redis                            | Redis ACL token leak                  | Unsigned eval Lua                             | Cache eviction = no audit              | Rate-limit pepper leak                           | OOM / eviction storm                           | Lua eval escapes                                                 |
| ⑥   | api → R2 / S3                          | Pre-signed URL theft                  | Object tag manipulation                       | Multipart upload partial commit        | Public bucket misconfig                          | Egress flood                                   | Bucket policy IAM mis-bind                                       |
| ⑦   | api → 3P (Anthropic / Stripe / Twilio) | Provider API key leak                 | Webhook signature forgery (Stripe — verified) | No request id round-trip               | Sensitive prompt content in 3P logs              | Provider rate-limit cascades                   | 3P RCE in adapter (unlikely; we'd be the victim, not the threat) |

## 3. Top abuse scenarios (ranked by impact)

| Rank | Scenario                                       | Likelihood | Impact   | Status                                                                                                                                                                                                                           |
| ---- | ---------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Credential-stuffing attack on /auth/login**  | High       | High     | MITIGATED — `RedisFailedLoginCounter` lockout, ThrottlerModule rate-limit per IP, optional MFA. Auth-error-spike runbook covers detection.                                                                                       |
| 2    | **Stolen refresh token replay**                | Medium     | High     | MITIGATED — refresh-token rotation with reuse-detection cascade revokes ALL sessions on detected replay. Device-fingerprint bind on top.                                                                                         |
| 3    | **Adversarial cache-busting on public routes** | Medium     | Medium   | PARTIAL — `TypedRedisCache` namespaces; per-route Throttler tuned. Edge WAF rules pending ([N9]).                                                                                                                                |
| 4    | **Stripe webhook signature forgery**           | Low        | Critical | MITIGATED — `StripePaymentProvider.verifyWebhook` uses constant-time `Stripe.webhooks.constructEvent`. Test in `payments-stripe.e2e-spec.ts`.                                                                                    |
| 5    | **PII leakage via verbose error response**     | Medium     | High     | MITIGATED — `AllExceptionFilter` redacts in `NODE_ENV=production`; `DomainExceptionFilter` returns a sanitised `code`. Sentry beforeSend filters known noisy errors.                                                             |
| 6    | **AI prompt injection → data exfiltration**    | Medium     | High     | PARTIAL — Anthropic / Gemini adapters pass user content unchanged. No tool calls today. When tools land, gate them by an allow-list + a confirm step in the agent flow ([POST.2A.5] roadmap).                                    |
| 7    | **DoS via /api/v1/plan (AI endpoint)**         | Medium     | Medium   | MITIGATED — per-route Throttler limit on /plan + fallback chain (Anthropic → Gemini → Ollama → Stub). The Stub is deterministic + < 50 ms; even a saturated AI route degrades gracefully.                                        |
| 8    | **Geo-doxxing via memory-book publish**        | Medium     | High     | MITIGATED — `exposeGeo()` coarsens PUBLIC + FOLLOWERS-no-optin to ~1dp (city level). FOLLOWERS+optin keeps precise; PRIVATE exposes nothing. Property tests cover the coarsening invariants.                                     |
| 9    | **SSRF via image-upload pre-signed URL spoof** | Low        | High     | MITIGATED — Pre-signed URLs scoped to specific bucket + key + max-size + content-type. Server never fetches arbitrary URLs on user behalf except via the Anthropic / Gemini adapters (which whitelist domain).                   |
| 10   | **Insider — leaked .env or git credentials**   | Low        | Critical | MITIGATED — Doppler is source of truth; `.env*` gitignored; quarterly rotation ([N6]). Breakglass procedure in `docs/runbooks/secrets.md`. Operator-owed: enable GitHub secret scanning + push protection (settings → security). |

## 4. Defense-in-depth posture

What we have today (mapped to where it lives in the code):

| Defense                           | Where                                                               |
| --------------------------------- | ------------------------------------------------------------------- |
| Helmet (CSP / HSTS / COOP / COEP) | `apps/api/src/common/security/security.register.ts`                 |
| Per-route rate limiting           | `@nestjs/throttler` + `RedisThrottlerStorage` (sliding-window Lua)  |
| Account lockout                   | `RedisFailedLoginCounter` (15m fixed window)                        |
| MFA (TOTP + backup codes)         | `apps/api/src/modules/identity/application/*-mfa-*.use-case.ts`     |
| Email + IP peppering              | `EMAIL_PEPPER`, `RATE_LIMIT_PEPPER`; never raw identifiers in Redis |
| JWT key rotation                  | `RedisJwtKeyringStore` + admin rotate endpoint                      |
| Trace-id correlation              | `getTraceContext()` AsyncLocalStorage, surfaces in every error      |
| Audit log on admin mutations      | `apps/api/src/modules/admin/...audit-log*`                          |
| Webhook signature verification    | `StripePaymentProvider.verifyWebhook` constant-time                 |
| Constant-time string comparison   | Used wherever a secret-equality check matters                       |
| SQL injection protection          | Prisma parameterised queries; raw queries via `GeoQueries` only     |
| `as any` ban                      | Fitness function in `architecture.fitness.spec.ts`                  |
| Critical-CVE block on merge       | `pnpm audit:critical` gate in `.github/workflows/ci.yml`            |
| Dependabot weekly                 | `.github/dependabot.yml` ([N7])                                     |
| Semgrep SAST                      | OWASP-top-ten + nodejsscan + typescript rule packs                  |
| OWASP ZAP DAST (informational)    | `.github/workflows/dast.yml`                                        |
| Free TLS                          | Fly + Cloudflare automatic certs                                    |

## 5. Threats we accept (with rationale)

- **Anthropic / Gemini reading user input** — by design; we route
  the plan-prompt to them. Disclosed in privacy policy + ToS.
  Sensitive PII is stripped from prompts before send.
- **A single Fly region outage taking us offline** — multi-region
  is in `production.tfvars` but not exercised end-to-end yet.
  Single-region downtime is part of the 99.5 % SLO budget.
- **No bug bounty program** — pre-launch posture. Open the program
  once user base > 1k and risk surface justifies the noise.

## 6. Operator-owed actions

1. **Enable GitHub secret scanning + push protection** — Settings →
   Code security → Secret scanning. Adds a third-party detection
   layer on top of our local hooks.
2. **Add a real pen test** — engage a third-party once the product
   has paid users. The DAST gate is the free substitute today.
3. **Wire a SECURITY.md disclosure inbox** — `security@<domain>`
   alias + GPG key. Done; see `SECURITY.md` at repo root ([N7]).

## 7. Cross-refs

- [`SECURITY.md`](../../SECURITY.md) — disclosure policy
- [`docs/runbooks/secrets.md`](../runbooks/secrets.md) — secret hygiene
- [`docs/runbooks/auth-error-spike.md`](../runbooks/auth-error-spike.md) — detection runbook
- [`apps/api/src/common/security/security.register.ts`](../../apps/api/src/common/security/security.register.ts) — the headers in code
