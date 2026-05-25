# GDPR / data-protection audit — TravelSuperApp

> **Status:** v1 (installed by [N10]).
> **Scope:** every data path that touches user personal data.
> **Last audit:** see git log of this file.
> **Cadence:** once per major feature release + once per quarter
> minimum, even if no features shipped.

## 1. Lawful basis (Art. 6)

| Data class                                | Lawful basis                  | Captured where                                       |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Email, hashed password                    | Contract (signup)             | `User` table + `RegisterUseCase`                     |
| Trip plans, itineraries                   | Contract                      | `Trip` + `ItineraryItem` tables                      |
| Geo coordinates inside a published trip   | Consent (visibility opt-in)   | `TripPublication.visibility` + `geo-precise-allowed` |
| Trusted-contact phone numbers             | Vital interests (SOS)         | `TrustedContact` table                               |
| Stripe customer id + subscription state   | Contract (paid tier)          | `User.stripeCustomerId` + `PaymentSubscription`      |
| MFA TOTP secret + backup codes            | Contract (security)           | `MfaEnrollment` table                                |
| Sentry / Honeycomb spans (no PII default) | Legitimate interest           | OTel + Sentry SDK; payload scrubbed via `beforeSend` |
| Cookie `refresh_token` (httpOnly)         | Strictly necessary (security) | Set by `/auth/login`                                 |
| Analytics / marketing cookies             | Consent                       | NOT YET SET (operator-owed before launch in EU)      |

## 2. Data-subject rights coverage

### Art. 15 — Right of access

| Channel                                 | What it returns                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/account/export`            | JSON dump of every row tied to the user: profile, trips, itinerary items, reviews, votes, comments, expenses, memory books, scam reports, sos events, agent profile, trusted contacts, preferences. Backed by `ExportUserDataUseCase` ([IV.18.16.1]) + `UserDataAggregator` adapter. Streaming variant for large accounts: `ExportUserDataStreamingUseCase` ([IV.18.16.4]). |
| `GET /api/v1/account/export?format=zip` | Zip of JSON + media-attachment list (pre-signed URLs, 7-day TTL).                                                                                                                                                                                                                                                                                                           |

**Tested:** [`apps/api/test/account-export.e2e-spec.ts`](../../apps/api/test/account-export.e2e-spec.ts) + [`account-export-streaming.e2e-spec.ts`](../../apps/api/test/account-export-streaming.e2e-spec.ts).

### Art. 16 — Right to rectification

Every editable field on `User` is exposed via `PATCH /api/v1/account`

- the per-feature edit endpoints (trip rename, review edit, etc.).
  For data they CAN'T edit themselves (e.g. internal flags like
  `bannedAt`), they file a support ticket → operator updates →
  audit-log row.

### Art. 17 — Right to erasure ("right to be forgotten")

`DELETE /api/v1/account` → `DeleteAccountUseCase`:

1. Mark `User.deletedAt = now()` (soft-delete; bans login).
2. Revoke every active session (`SessionRepository.revokeAllForUser`).
3. Issue `Identity.AccountDeleted` domain event.
4. The user has 7 days to `POST /api/v1/account/reactivate` (recovery
   token). After 7 days, `AccountPurgeScheduler` runs the hard-delete:
   - Removes the `User` row + every owned `Trip`, `Itinerary*`,
     `Review`, `Vote`, `Comment`, `Expense`, `MemoryBook`,
     `ScamReport`, `SosEvent`, `AgentProfile`, `TrustedContact`,
     `MediaAsset`, `Preferences`.
   - Schedules R2 media deletions through `OrphanS3SweepScheduler`.
   - Anonymises co-authored content (replaces `authorId` with the
     reserved "deleted-user" sentinel where the content has value
     to others — e.g. a public review).
5. Audit-log row in `AuditLog` captures the action + actor.

**Tested:** [`apps/api/test/account-delete.e2e-spec.ts`](../../apps/api/test/account-delete.e2e-spec.ts) (immediate flow) + [`account-purge.e2e-spec.ts`](../../apps/api/test/account-purge.e2e-spec.ts) (7-day delayed hard-delete) + [`reactivation.e2e-spec.ts`](../../apps/api/test/reactivation.e2e-spec.ts) (the recovery window).

### Art. 18 — Right to restriction

The 7-day reactivation window IS the restriction mechanism — the
user can pull the data back during that window before hard-delete.
For explicit "freeze my data while we investigate" requests outside
that window, operators set `User.processingRestrictedAt` (column
exists; UI surface is TODO).

### Art. 20 — Right to data portability

Same as Art. 15 — `GET /account/export` returns JSON in a documented
schema (`docs/api/openapi.yaml` → `UserDataExport`). The format is
versioned (`formatVersion: 1`) so future export-importers from / to
this format work deterministically.

### Art. 21 — Right to object

For automated decisions (Stripe webhook → subscription status,
agent recommendations), the user can:

- Cancel subscription → object to processing for that purpose
  (`POST /api/v1/billing/cancel`).
- Disable agent → object to agent-driven processing
  (`PATCH /api/v1/preferences { "agent": "off" }`).

## 3. Retention

| Class                               | Retention                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Active user data                    | While account exists.                                                                         |
| Soft-deleted user data              | 7 days (recovery window). Hard-delete by `AccountPurgeScheduler`.                             |
| Failed-login counter (`login-fail`) | 15 min (fixed-window Redis TTL).                                                              |
| Trace spans (Honeycomb)             | 60 days free tier; 30 days budget for prod.                                                   |
| Sentry events                       | 90 days free tier; budget-controlled in prod.                                                 |
| Server logs (Fly + Pino JSON)       | 7 days hot, archived to R2 cold for 90 days. Operator-owed: configure log archive.            |
| Audit log (`AuditLog`)              | 7 years (financial / GDPR-prove-we-did-the-deletion-paper-trail). NEVER purged automatically. |
| Stripe / Twilio / Resend            | Per provider's retention (out of our hands; documented in privacy policy).                    |

Retention enforced by:

- `AccountPurgeScheduler` (daily, 24h interval, soft-delete > 7d hard-delete).
- `OrphanS3SweepScheduler` (24h, deletes media whose owner row no longer exists).
- Domain-event-bus has no PII payload by convention; verify with a fresh `grep` on the EventBus subscribers.

## 4. Cross-border transfer

Today the data path crosses borders ONLY for:

- Honeycomb / Sentry / Doppler / Cloudflare (US providers) — covered
  by their SCC + DPA agreements with us.
- Anthropic / Google Gemini / Resend / Twilio / Stripe — same.
- Open-Meteo / OpenSky / OSM — no PII routed there; only coordinates.

When EU users land, add the standard "transfers covered by SCCs +
each provider has a DPA" clause to the privacy policy.

## 5. Children's data

The privacy policy will state "no users under 16 in the EU / 13 in
the US". Today the api has no age gate; ENFORCED via the signup form
in `apps/web` (operator-owed UX work).

## 6. PII inventory + redaction

| Column / field                    | Stored as            | Redacted in logs / traces                                                   |
| --------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `User.email`                      | plaintext            | NO — logged at register / login (deliberate, scrubbed by Sentry beforeSend) |
| `User.hashedEmail`                | sha256(pepper+email) | YES — never in logs                                                         |
| `User.passwordHash`               | bcrypt               | NEVER logged                                                                |
| `User.displayName`                | plaintext            | Often in logs (trip ownership messages)                                     |
| `User.role`                       | enum                 | Yes in logs (audit)                                                         |
| `User.bannedAt`, `User.deletedAt` | timestamp            | Yes in logs                                                                 |
| `TrustedContact.phone`            | plaintext            | NO — never logged                                                           |
| `SosEvent.lat` / `lng`            | plaintext            | YES (coarsened to 1dp on emit)                                              |
| `Trip.center` (PostGIS point)     | plaintext            | YES (exposed via `exposeGeo()` only)                                        |
| `MfaEnrollment.totpSecret`        | encrypted            | NEVER logged                                                                |
| `Stripe customer id`              | plaintext            | YES — in payments-related logs                                              |

Sentry's `beforeSend` (in `apps/api/src/sentry.init.ts`) is the
primary scrub line; verify it covers the patterns above by reading
the `sendDefaultPii: false` option + the request-body filter.

## 7. Audit summary (this run)

| Check                                      | Result                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Art. 15 access flow exists + tested        | ✅ `account-export.e2e-spec.ts` covers happy + streaming path                                                |
| Art. 17 erasure flow exists + tested       | ✅ `account-delete.e2e-spec.ts` + `account-purge.e2e-spec.ts`                                                |
| Retention is automated, not manual         | ✅ `AccountPurgeScheduler` + `OrphanS3SweepScheduler`                                                        |
| Audit log captures admin + user actions    | ✅ `apps/api/src/modules/admin/...audit-log*` ([V.UX.16-era]); verified by `admin-audit-log.e2e-spec.ts`     |
| Sentry beforeSend scrubs PII               | ✅ `sendDefaultPii: false` + custom `beforeSend` filter                                                      |
| Honeycomb spans default to NO PII          | ✅ auto-instrumentation captures method/url/duration/status — no headers or bodies                           |
| Privacy policy live + linked from web      | ❌ OPERATOR-OWED — `apps/web/src/app/privacy/page.tsx` is a stub                                             |
| Cookie consent banner (EU users)           | ❌ OPERATOR-OWED — when EU traffic actually arrives                                                          |
| DPA executed with each sub-processor       | ❌ OPERATOR-OWED — Anthropic / Google / Resend / Twilio / Stripe DPAs need countersigning before paid launch |
| Cross-border transfer disclosure           | ❌ OPERATOR-OWED — add to privacy policy when it lands                                                       |
| Age gate (under-16 in EU / under-13 in US) | ❌ OPERATOR-OWED — signup-form UX work                                                                       |

## 8. Operator-owed actions (to land before EU launch)

1. Publish a real privacy policy at `/privacy` linked from every
   page footer + the signup flow.
2. Wire a cookie consent banner — strictly necessary cookies (sessions)
   pre-checked; analytics / marketing OFF until consent.
3. Counter-sign DPAs with each sub-processor; archive them in
   `docs/compliance/dpas/`.
4. Add an age gate to the signup form ("I am at least 16").
5. Schedule the FIRST quarterly re-audit of this doc (calendar +
   diary it; this isn't a one-and-done file).

## 9. References

- [`apps/api/src/modules/account/`](../../apps/api/src/modules/account/) — every flow this audit covers
- [`docs/security/threat-model.md`](../security/threat-model.md) — overlapping defense posture
- [`docs/runbooks/backups-dr.md`](../runbooks/backups-dr.md) — retention story
- [GDPR official text](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
