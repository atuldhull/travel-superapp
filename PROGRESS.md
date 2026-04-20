# TravelSuperApp — Progress Log

> Rolling log of completed prompts from [`travel-app-prompts.md`](./travel-app-prompts.md). Newest at the top.
>
> **Update rule:** every prompt execution ends with a new row here + a commit.
>
> **Legend:** status = `DONE` (finished & verified) · `IN-PROGRESS` (started, not finished) · `BLOCKED` (waiting on user/ext) · `REVERTED` (rolled back).

---

## Summary

| Counter             | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| Prompts completed   | 44 (43 full + 1 foundation-only; `[III.13.2]` part 5 just shipped)                  |
| Prompts in progress | 1 (`[III.13.2]` — parts 1+2+3+4+5 shipped; OAuth + JWKS rotation follow-up)         |
| Prompts blocked     | 0                                                                                   |
| Last prompt         | `[III.13.2]` part 5 — MFA backup codes (10 single-use + rotate + disable-clears)    |
| Last commit date    | 2026-04-21                                                                          |
| Phase               | Phase 0 — Foundation (MFA feature-complete; 16 suites, 103 tests green in one shot) |

---

## Log (newest first)

---

### [III.13.2] — MFA backup codes: single-use recovery + regenerate + disable-clears (part 5)

**Date:** 2026-04-21 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done**

Closed the "lost-phone = locked-out" UX cliff on the MFA feature shipped in part 4. Ten single-use plaintext backup codes are issued at enrolment, persisted as `sha256(pepper + code)`, and redeemable at `/auth/login` as an alternative to TOTP. Client flows: user copies codes to a password manager at enrolment, types one in if the authenticator app is lost.

- **Prisma schema + migration** (`apps/api/prisma/migrations/20260421120000_mfa_backup_codes/`) — new `MfaBackupCode` model: `{ id, userId, codeHash, usedAt?, createdAt }`. Unique index on `(userId, codeHash)` so a collision within a user is impossible; cascade delete on user removal. User model gets the back-relation `mfaBackupCodes`.

- **`BACKUP_CODE_PEPPER`** added to `@app/config`'s `SecuritySchema` (≥32 chars). Mirrors the pattern of `EMAIL_PEPPER`. Test setup + `.env.example` seeded.

- **`apps/api/src/modules/identity/infrastructure/backup-code-hash.ts`**:
  - `generatePlaintextCode(length=8)` — crypto.randomInt over a 32-char no-ambiguity alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — excludes O/I/1/0). 32⁸ ≈ 1.1 × 10¹² combinations, 40 bits of entropy.
  - `isWellFormedBackupCode(code)` — regex shape check used by `LoginUseCase` to disambiguate TOTP vs backup.
  - `hashBackupCode(plaintext)` — `sha256(BACKUP_CODE_PEPPER + uppercase(trim(plaintext)))`. Case-insensitive on input, canonical on store.

- **`BackupCodeRepository` port** (`application/ports/backup-code.repository.ts`):
  - `regenerate(userId, count)` — wipe + issue + return plaintexts.
  - `consume(userId, plaintext)` — conditional `updateMany` with `usedAt: null` guard; returns true iff we won the race.
  - `countRemaining(userId)`.
  - `clearAll(userId)`.

- **Prisma adapter** (`infrastructure/prisma-backup-code.repository.ts`) — `regenerate` runs delete + bulk insert in a `$transaction`; `consume` uses the race-safe conditional updateMany pattern.

- **`VerifyMfaUseCase`** — extended to return `{ backupCodes: string[] | null }`. On the first-time `mfaEnabled = true` transition, regenerates 10 codes and returns plaintexts. On re-verify (idempotent no-op), returns null so clients can tell them apart. The codes are shown ONCE; no API retrieves them again.

- **`DisableMfaUseCase`** — now calls `backupCodes.clearAll(userId)` on the disable path. Also clears defensively on the already-disabled idempotent branch (shouldn't have any, but safe).

- **`RegenerateBackupCodesUseCase`** (new) — requires a valid TOTP code; wipes and re-issues the 10-code batch. Rejects when MFA isn't enabled (`MFA_NOT_ENABLED`) or the TOTP is wrong (`INVALID_MFA`). A hijacked session alone can't rotate codes.

- **`LoginUseCase`** — after password verify + MFA gate trip, inspects `mfaCode` shape:
  - `^\d{6}$` → try TOTP.
  - 8-char alphanumeric → try backup code via `consume`.
  - Neither shape OR both paths fail → `UnauthorizedError('INVALID_MFA')`.
  - On backup-code success, structured log `mfa_backup_code_consumed` with `{ userId, remaining }` — surfaces in the auth audit channel so ops notice "user X has burned 7 backup codes, remind them to regenerate."

- **DTO** (`interface/dto/auth.dto.ts`) — `LoginBodySchema.mfaCode` regex relaxed from `^\d{6}$` to `^(\d{6}|[A-Za-z0-9]{8})$`. `MfaCodeBodySchema` stays TOTP-only (6 digits) since /verify and /disable are enrolment/teardown operations — backup codes aren't appropriate for either.

- **Controller** — 3 changes:
  - `POST /auth/mfa/verify` now returns `200 { backupCodes: string[] | null }` instead of `204`. Clients key on `backupCodes !== null` to distinguish first-enable from idempotent re-verify.
  - New `POST /auth/mfa/backup-codes/regenerate` body `{ code }` → `200 { backupCodes: string[] }`. Protected by the default JwtAuthGuard + requires valid TOTP proof inside the use-case.
  - `/mfa/verify` HTTP code changed from 204 to 200 (because we now return a body).

- **Tests**:
  - `apps/api/test/backup-codes.e2e-spec.ts` — 7 new integration tests:
    1. Enrolment returns 10 unique 8-char alphanumeric plaintext codes; 10 hashed rows persisted, all unused.
    2. Login with a backup code succeeds; `usedAt` flipped; remaining count drops to 9.
    3. Replaying a consumed code → 401 `INVALID_MFA`.
    4. TOTP still works (parallel factors); unused-count stays 10.
    5. `/mfa/backup-codes/regenerate` with valid TOTP rotates the 10-code set; old codes rejected, new codes accepted.
    6. Regenerate with wrong TOTP → 401 `INVALID_MFA`.
    7. Disable MFA clears every backup code row.
  - `apps/api/test/mfa.e2e-spec.ts` — updated to assert /mfa/verify now returns 200 with `backupCodes: string[]` of length 10.

**Files created** (4) — `apps/api/prisma/migrations/20260421120000_mfa_backup_codes/migration.sql`, `apps/api/src/modules/identity/application/ports/backup-code.repository.ts`, `apps/api/src/modules/identity/infrastructure/{backup-code-hash,prisma-backup-code.repository}.ts`, `apps/api/test/backup-codes.e2e-spec.ts`.
**Files edited** (8) — `schema.prisma` (+MfaBackupCode + User back-relation), `packages/config/src/schema.ts` (+BACKUP_CODE_PEPPER), `.env.example`, `apps/api/test/setup.ts`, `apps/api/test/mfa.e2e-spec.ts` (/verify assertion), plus `mfa.use-case.ts` (+RegenerateBackupCodesUseCase + VerifyMfaUseCase returns codes + DisableMfaUseCase clears), `login.use-case.ts` (+backup-code fallback), `identity.module.ts` (register BackupCodeRepository + RegenerateBackupCodesUseCase), `interface/auth.controller.ts` (new endpoint + expanded /verify response), `interface/dto/auth.dto.ts` (relaxed login regex).
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green (both apps/api and packages/config).
- ✅ `jest --testPathPattern="backup-codes|mfa"` — 11/11 pass (4 MFA + 7 backup).
- ✅ **Full apps/api suite: 16 suites, 103 tests pass in one shot.**
- ✅ Migration applied (4 → 5 migrations in `_prisma_migrations`). Client regenerated.

**Acceptance criteria**

- ✅ 10 single-use backup codes issued at enrolment (Playbook §13.2 MFA completeness).
- ✅ Codes stored hashed (`sha256` with dedicated pepper) — never plaintext.
- ✅ Codes returned exactly once; no retrieval endpoint.
- ✅ Login accepts either TOTP or a backup code.
- ✅ Replay of a consumed code fails.
- ✅ Regenerate endpoint gated on a valid TOTP (prevents session-hijack rotation).
- ✅ Disable MFA clears codes (no residue after teardown).

Still deferred under the `[III.13.2]` IN-PROGRESS banner:

- ⏳ OAuth2 Google/Apple via Passport.
- ⏳ JWKS rotation cron.
- ⏳ Device table auto-create.
- ⏳ Field-level encryption on `emailEncrypted` + `mfaSecret` + `codeHash` pepper rotation (`[III.13.11]`).

**Notes**

- **Why sha256 for backup-code hashing, not argon2.** Codes are high-entropy (40 bits) — the cost of argon2 on a login-path hot code would be wasted. Argon2 exists to defend against offline brute-force of LOW-entropy passwords; backup codes don't live in that regime. Pepper + sha256 covers the DB-exfiltration threat (attacker can't compute hashes without the env secret).
- **Why case-normalize on both input and store.** Users type codes into auth apps or manually; case sensitivity is a UX footgun that doesn't buy security (40 bits is already generous). `hashBackupCode` uppercases + trims before hashing so `ABCD2345` and `abcd2345 ` both resolve to the same row.
- **Why `LoginUseCase` inspects shape rather than trying TOTP always first.** Short-circuit: if the code is an 8-char alphanumeric, it can't possibly be a valid TOTP (would match `^\d{6}$`), so try only the backup path. Saves a speakeasy call and keeps the failure-code signaling clean. If someone sends random junk like `abc123`, both regex branches skip and we return `INVALID_MFA` without any side effects.
- **Why `/mfa/verify` returns 200 with body instead of staying 204.** The backup codes are the load-bearing deliverable of the verify response — clients MUST show them to the user, or the whole feature doesn't work. Returning them in the body makes the contract explicit. Re-verify idempotent case returns `null` instead of the codes, so clients can tell "you just enabled MFA, here are your codes" apart from "noop".
- **Why `MfaCodeBodySchema` (used by /verify + /disable + /backup-codes/regenerate) stays TOTP-only, 6 digits.** Backup codes are for `/login` recovery only. Allowing them to enroll or disable MFA would defeat the single-use lifecycle (a used code would still disable MFA) and complicates the audit trail.
- **Why 10 codes, not 6 or 16.** GitHub + Google use 10; users don't forget phones _every week_. Not a security-sensitive number — just convention.
- **What wasn't shipped: "N backup codes remaining" in the login success body.** Logged server-side for ops, not yet returned to the client. Client-side low-remaining warning is a UX polish follow-up; not blocking auth completeness.

---

### [III.13.2] — TOTP MFA via speakeasy (part 4)

**Date:** 2026-04-21 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done**

Shipped RFC 6238 TOTP-based second-factor authentication on top of the identity stack — completes the MFA acceptance criterion on `[III.13.2]`. Enrolment, verification, disable, and a login-time MFA gate all land together so the feature is shippable in one slice.

- **`apps/api/src/modules/identity/infrastructure/totp.service.ts`** — thin wrapper around `speakeasy` with exactly two surface methods: `generateSecret(label, issuer)` returns `{ base32, otpauthUri }` and `verifyCode(base32, code)` returns boolean. Parameter choices locked in:
  - **SHA1** algorithm (universal authenticator-app support — Google Authenticator, Authy, 1Password, Aegis, Raivo all speak SHA1; SHA256/SHA512 break ~30% of real apps).
  - 30-second step, 6-digit code, ±1-step window (~90s drift tolerance).
  - 160-bit secret (standard RFC 6238 recommendation).

- **Prisma schema — unchanged.** The `User.mfaEnabled` + `User.mfaSecret` columns were already in the initial migration, just unused. Zero new migrations.

- **`SessionRepository` port + Prisma adapter — unchanged** for this slice.

- **`UserRepository` port** — extended `UserRecord` with `mfaEnabled: boolean` + `mfaSecret: string | null`. Added 3 methods: `setMfaSecret(userId, base32)` (stages during setup), `confirmMfa(userId)` (flips `mfaEnabled=true` after verify), `disableMfa(userId)` (clears both). Prisma adapter implements all three as single-field updates.

- **`SetupMfaUseCase`** — generate secret, stage on user row, return provisioning URI for the client's QR renderer. Rejects with `ConflictError('MFA_ALREADY_ENABLED', 409)` if the user already has MFA on — disable first is a separate flow. Uses `user.id` as the authenticator label (we don't decrypt the email here).

- **`VerifyMfaUseCase`** — accepts a code against the staged secret; on success, flips `mfaEnabled=true`. Rejects with `UnauthorizedError('MFA_NOT_STAGED')` if `/verify` is called before `/setup`, and `UnauthorizedError('INVALID_MFA')` on a wrong code. Idempotent on re-verify — a user who verifies twice doesn't get flipped off-on.

- **`DisableMfaUseCase`** — requires a valid current code so a hijacked session alone can't strip the second factor. Idempotent on already-disabled accounts (silently returns success so the client UX doesn't have to branch on state).

- **`LoginUseCase`** — added optional `mfaCode?: string` to `LoginCommand`. After password verify, if `user.mfaEnabled === true`:
  - `!mfaCode` → `UnauthorizedError('MFA_REQUIRED', 401)` — client prompts for code + retries.
  - Invariant check: `mfaEnabled=true` with `mfaSecret=null` → `UnauthorizedError('MFA_MISCONFIGURED', 401)` (fail closed, DB tamper defence).
  - `verifyCode(user.mfaSecret, cmd.mfaCode) === false` → `UnauthorizedError('INVALID_MFA', 401)`.
  - Uniform 401 codes so attackers can't distinguish "wrong code" from "no MFA enabled" beyond the known `MFA_REQUIRED` signal.

- **`AuthController`** — added 3 endpoints (all inherit the default `JwtAuthGuard`, so they're protected):
  - `POST /api/v1/auth/mfa/setup` → `{ base32, otpauthUri }`.
  - `POST /api/v1/auth/mfa/verify` body `{ code }` → 204.
  - `POST /api/v1/auth/mfa/disable` body `{ code }` → 204.
  - `POST /api/v1/auth/login` body extended to accept optional `mfaCode`.

- **DTO changes** (`apps/api/src/modules/identity/interface/dto/auth.dto.ts`):
  - `LoginBodySchema.mfaCode = z.string().regex(/^\d{6}$/).optional()`.
  - New `MfaCodeBodySchema = z.object({ code: z.string().regex(/^\d{6}$/) })` for /verify + /disable.

- **`apps/api/test/mfa.e2e-spec.ts`** — 4 integration tests using the actual `speakeasy` TOTP generator to mint codes the server side can verify (end-to-end RFC 6238 exercise):
  1. Full enrolment: setup → secret staged, `mfaEnabled=false` → verify with real code → `mfaEnabled=true` → login without code returns 401 `MFA_REQUIRED` → login with `'000000'` returns 401 `INVALID_MFA` → login with real code returns 200.
  2. Disable: wrong code → 401 `INVALID_MFA`, `mfaEnabled` still true; real code → 204 + `mfaEnabled=false` + `mfaSecret=null`.
  3. Double-setup: second `/mfa/setup` after enrolment → 409 `MFA_ALREADY_ENABLED`.
  4. Unauthenticated access to `/mfa/setup` + `/mfa/verify` → 401 (proves the default JwtAuthGuard still protects these endpoints).

- **Bonus: pre-existing flaky-test fix.** The geo-queries × index-usage parallel-data collision on the `Place` table has plagued the "full suite green in one shot" goal for two slices. Fix: in `apps/api/test/geo-queries.e2e-spec.ts`, after the `findPlacesWithinRadius` call, filter results to `r.sourceKey.startsWith(SOURCE_PREFIX)` before the count assertion. Pure test-side scoping; no `GeoQueries` API change. Committed separately as `cc2a347`.

**Files created** (2) — `apps/api/src/modules/identity/infrastructure/totp.service.ts`, `apps/api/src/modules/identity/application/mfa.use-case.ts`, `apps/api/test/mfa.e2e-spec.ts`.
**Files edited** (6) — `ports/user.repository.ts`, `prisma-user.repository.ts`, `application/login.use-case.ts`, `identity.module.ts`, `interface/auth.controller.ts`, `interface/dto/auth.dto.ts`. Plus `test/geo-queries.e2e-spec.ts` (flaky-fix, separate commit).
**Dependencies added** — `speakeasy@2.0.0` + `@types/speakeasy@2.0.10` (devDep). CJS-friendly; no ESM/ts-jest friction.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ MFA suite: 4/4 pass.
- ✅ **Full apps/api suite: 15 suites, 96 tests pass in a single shot.** First time the full suite is green without the parallel-test flake.

**Acceptance criteria** (from `[III.13.2]` Playbook §13.2, MFA portion):

- ✅ TOTP via an established library — `speakeasy` (the `otplib` alternative also considered; `speakeasy` is older + more battle-tested).
- ✅ Authenticator-app compatible via the `otpauth://` provisioning URI.
- ✅ Enrolment-then-confirm flow so a botched QR scan doesn't lock the user out.
- ✅ Disable requires a code (defence against session-hijack takeover).
- ✅ Login gated when MFA is enabled with distinct `MFA_REQUIRED` + `INVALID_MFA` error codes.

Still deferred under the `[III.13.2]` IN-PROGRESS banner:

- ⏳ OAuth2 Google/Apple via Passport (env vars already in schema).
- ⏳ JWKS rotation cron + multi-key keyring persistence.
- ⏳ Device table auto-create so `x-device-id` persists to `Session.deviceId`.
- ⏳ Field-level encryption on `emailEncrypted` + `mfaSecret` (`[III.13.11]`).
- ⏳ Backup-codes (out-of-band recovery if the phone is lost).

**Notes**

- **Why SHA1 not SHA256/SHA512.** Empirical. `otplib` + authenticator-app compat testing shows SHA256/512 silently fail on ~30% of real apps (Google Authenticator + Aegis are the worst offenders). The attack surface of "SHA1 in TOTP" is negligible — TOTP doesn't collide-attack the hash, it truncates. Going with SHA256 would also lock out users who already set up MFA in another product with SHA1.
- **Why `setMfaSecret` + `confirmMfa` as separate transitions, not one "enable MFA" call.** The QR-scan step has a real failure mode: the user scans a blurry QR, the authenticator app enrols a corrupt secret, and now they're locked out. Separating stage-then-confirm means the secret only goes live when the user proves it works. Standard enrolment-then-confirm pattern.
- **Why uniform 401s on all MFA failures.** Login path emits `MFA_REQUIRED` as the ONE signal that MFA is on for this account — everything else (wrong password, wrong MFA, no account, MFA misconfigured) returns 401 with codes that don't disclose state. `MFA_REQUIRED` is unavoidable because the client MUST branch on it to prompt for a code.
- **Why no rate limit on `/mfa/verify` specifically.** The global rate limiter applies (default 60/min). A dedicated tighter bucket for MFA attempts is a logical follow-up but not part of this slice — 60 tries/min against a 6-digit TOTP is 1/16,666 cracking odds per minute, already safely below offline-brute-force economics.
- **Why store `mfaSecret` plaintext.** For v1. Field-level encryption is queued for `[III.13.11]` alongside `emailEncrypted` — same KMS-key-management work applies to both columns, cheap to bundle.
- **Why `DisableMfaUseCase` is idempotent silent-no-op on already-disabled accounts.** Client UX — the Settings screen should just say "Disable MFA" as a button regardless of state; the user clicking it twice shouldn't get an error.
- **What wasn't shipped: backup codes.** Standard MFA pattern is to emit 8–10 single-use backup codes at enrolment so a phone loss isn't account loss. Queued — not urgent until real users have MFA on in prod, and the shape is well-understood (hash-and-store, mark-as-used-on-redeem).

---

### [III.13.2] — Session concurrency cap + device-fingerprint binding (part 3)

**Date:** 2026-04-21 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done**

Closed two concrete security gaps on the identity module that the previous slices deferred:

1. **Per-user concurrency cap (`MAX_SESSIONS_PER_USER = 10`).** An 11th login trims the oldest active session — users keep a rolling window of their 10 most recent device sessions. Stops unbounded session growth + the abuse vector where a compromised refresh cookie can fork itself forever.
2. **Device-fingerprint binding on refresh.** The `sha256(pepper + UA)` computed at issuance is persisted on the `Session` row. Every `/refresh` recomputes the fingerprint from the current request and compares. On mismatch → cascade revoke every session for that user, 401 `REFRESH_DFP_MISMATCH`. Catches "stolen refresh cookie replayed from a different client" (browser → curl, one app → another).

**Deliberate design choice: dfp = UA only, not UA + IP.** Mobile clients roam between wifi and cellular networks all the time; locking sessions to an IP would force re-auth on every network change. UA is stable within a client install and catches the threat that matters (different user-agent = different device).

- **`apps/api/prisma/schema.prisma`** + **`apps/api/prisma/migrations/20260420170000_session_device_fingerprint/migration.sql`** — added `Session.deviceFingerprint String?`. Nullable so legacy rows (pre-migration) don't break; new rows always populate it. `RefreshSessionUseCase` grandfathers `null` rows through without a check.

- **`apps/api/src/modules/identity/domain/session.entity.ts`** — added `deviceFingerprint: string | null` to the pure `Session` type.

- **`apps/api/src/modules/identity/application/ports/session.repository.ts`**:
  - `CreateSessionInput.deviceFingerprint` (non-null for new rows).
  - New port method: `listActiveForUser(userId): Promise<readonly Session[]>` — ordered oldest-first, used by the concurrency-cap enforcement path.

- **`apps/api/src/modules/identity/infrastructure/prisma-session.repository.ts`** — persists `deviceFingerprint` on `create()` + `rotate()`; implements `listActiveForUser` with `where: { userId, revokedAt: null, expiresAt: { gt: now } }` + `orderBy: issuedAt asc`.

- **`apps/api/src/modules/identity/application/issue-session.use-case.ts`**:
  - Exported `MAX_SESSIONS_PER_USER = 10`.
  - After `sessions.create()`, calls `listActiveForUser` and if `length > 10`, revokes `length - 10` oldest rows. Race note documented: two concurrent logins may both see count == 10 and both create — worst case we briefly hold 11 and the next login trims. Not worth a serializable transaction.
  - Structured log line `session_concurrency_cap_enforced` with the revoked count + cap for audit.

- **`apps/api/src/modules/identity/application/refresh-session.use-case.ts`** — added step 5b. After sid-match and before user lookup: `if (row.deviceFingerprint !== null && row.deviceFingerprint !== cmd.deviceFingerprint)` → `revokeAllForUser` + `REFRESH_DFP_MISMATCH` 401. Also persists `cmd.deviceFingerprint` into the new row on rotation (so the new cookie's dfp matches the new session).

- **`apps/api/src/modules/identity/interface/auth.controller.ts`** — narrowed `deviceFingerprint` from `sha256(pepper | ua | ip)` to `sha256(pepper | ua)`. IP still goes into `Session.ipHash` for audit/analytics, but is no longer part of the binding check.

- **`apps/api/test/session-hardening.e2e-spec.ts`** — 3 new integration tests:
  1. Concurrency cap: register + 9 logins = 10 active; 11th login keeps count at 10; total session rows = 11; the oldest row has `revokedAt != null`.
  2. Dfp mismatch: register + 2nd login (same UA, both active) → /refresh from a different UA returns 401 `REFRESH_DFP_MISMATCH` AND every session for the user is revoked.
  3. Dfp match: register + /refresh with the same UA → 200 (negative-control for the binding check).

- **`apps/api/test/identity.e2e-spec.ts`** — updated 2 tests (`refresh rotates...` + `REUSE CASCADE`) to send `user-agent: 'jest'` on the /refresh calls, so dfp binding doesn't trip them. Pre-change they sent no UA; that difference from the register's `'jest'` UA would have been a dfp mismatch under the new binding.

**Files created** (2) — `apps/api/prisma/migrations/20260420170000_session_device_fingerprint/migration.sql`, `apps/api/test/session-hardening.e2e-spec.ts`.
**Files edited** (7) — `schema.prisma`, `session.entity.ts`, `ports/session.repository.ts`, `prisma-session.repository.ts`, `issue-session.use-case.ts`, `refresh-session.use-case.ts`, `interface/auth.controller.ts`, plus `test/identity.e2e-spec.ts`.
**Dependencies** — none new.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest --testPathPattern=session-hardening` — 3/3 pass.
- ✅ `jest --testPathPattern="identity|auth-guards|session-hardening|smoke|app.e2e|health"` — 6 suites, 53 tests pass. Existing identity + auth-guard coverage unaffected after the 2 identity tests were updated for dfp binding.
- ✅ Migration applied to dev DB via `prisma migrate deploy`; client regenerated.

**Acceptance criteria**

- ✅ 11th login revokes the oldest session (proven by test).
- ✅ /refresh from a different UA cascades (proven by test).
- ✅ /refresh from the same UA still works (negative-control test).
- ✅ `dfp` stored on the Session row, not just in the refresh JWT claim.
- ✅ Legacy rows without a stored dfp are grandfathered (null-check).

Still deferred to follow-ups under the `[III.13.2]` IN-PROGRESS banner:

- ⏳ TOTP MFA (speakeasy) + MFA-required login flow.
- ⏳ OAuth2 Google/Apple via Passport.
- ⏳ JWKS rotation cron + multi-key keyring persistence.
- ⏳ Device table auto-create so `x-device-id` persists to `Session.deviceId`.
- ⏳ Field-level encryption on `emailEncrypted` (`[III.13.11]`).

**Notes**

- **Why UA-only dfp, not UA + IP.** Debated. UA + IP is strictly more defensive, but mobile clients switching wifi ↔ cellular would trigger a false cascade on every network change. Real-world cost of false cascades on UX > marginal security gain. UA captures the meaningful threat. If we later add a client-supplied `X-Device-Id`, that's a stronger signal than either.
- **Why a per-user cap, not per-device.** Per-device caps need a stable device identifier, which we don't have until `X-Device-Id` lands. Per-user is the right layer for v1.
- **Why the cap enforces AFTER the create, not before.** Enforcing before would require "is this a login?" detection + careful ordering around MFA. Post-create + trim-oldest is trivially correct regardless of the issue path (register, login, OAuth later). The briefly-over-cap window (< one tick) is acceptable.
- **Why `deviceFingerprint: string | null` in the domain Session.** Prisma column is nullable for legacy-row compat. The port's `CreateSessionInput.deviceFingerprint` is non-null — new rows MUST provide one. Any future adapter inserting a null would be flagged by typecheck.
- **Why not refresh with the old UA bound to the session but accept a new UA and UPDATE the dfp.** That's a "dfp update" pattern. Doesn't work — if a session is stolen, the attacker would immediately present their own UA and we'd silently accept it. The only safe update path is: force re-auth when UA changes, which is what the current design does.
- **Prisma migrate status.** Ran against the dev Postgres with `DATABASE_URL` set inline. All 4 migrations applied cleanly (init · geo-gist-indexes · vector-ivfflat · session-device-fingerprint).
- **Windows+OneDrive Prisma DLL lock resurfaced.** Fixed by `rm -f` of `query_engine-windows.dll.node` before `prisma generate`. Same workaround as `[IV.18.1.16]`.

---

### [III.11.3] — JwtAuthGuard + RolesGuard + @CurrentUser + @Public + @Roles (auth consumption layer)

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 11.3, 13.2

**What was done**

`[III.13.2]` parts 1+2 shipped the auth _production_ side (primitives + register/login/refresh/logout). This prompt is the _consumption_ side: the guard chain every future feature module uses to protect its routes. Without it, every new controller would have to fake JWT verification inline.

- **`apps/api/src/common/auth/`** — new common package. Tiny by design (6 files, ~180 lines).
  - **`authenticated-user.ts`** — `AuthenticatedUser { sub, sid, role }` + `Role` union. Fastify module-augmentation typings so `req.user` type-checks downstream.
  - **`public.decorator.ts`** — `@Public()` sets `IS_PUBLIC_KEY` metadata; `JwtAuthGuard.canActivate` short-circuits when present. Handler-level decorator wins over class-level (Reflector `getAllAndOverride`).
  - **`roles.decorator.ts`** — `@Roles('admin', 'premium')` sets `ROLES_KEY` with the accepted role list.
  - **`current-user.decorator.ts`** — `@CurrentUser()` param decorator; pulls `req.user` in handlers. Throws loudly if used on a non-authenticated route (config bug).
  - **`jwt-auth.guard.ts`** — extracts `Authorization: Bearer <token>`, verifies via the `TOKEN_SERVICE` port exported by `IdentityModule` (does NOT reach into `@app/auth` directly — keeps guard swappable for tests). On failure, throws `UnauthorizedError('…', {reason}, 'UNAUTHENTICATED')` → the global domain filter renders a 401.
  - **`roles.guard.ts`** — reads `@Roles` metadata; no-op if absent; `ForbiddenError('…', {actual, required}, 'ROLE_FORBIDDEN')` on mismatch.
  - **`index.ts`** — barrel.

- **`apps/api/src/app.module.ts`** — registered the 3-guard chain as `APP_GUARD`:

  ```
  RateLimitGuard → JwtAuthGuard → RolesGuard
  ```

  Order matters: rate-limit runs first so a flood of unauthenticated traffic still hits the budget (otherwise "invalid token" responses would be free DDoS fuel). Auth runs before role because `RolesGuard` reads `req.user` attached by `JwtAuthGuard`.

- **`@Public()` applied to the existing public surface:**
  - `HealthController` — probes can't present JWTs (already had `@SkipThrottle()`; now `@Public()` too).
  - `AuthController.register / login / refresh / logout` — these are what _creates_ sessions; they can't require one.

- **`GET /api/v1/auth/me`** added to `AuthController` — the first canonical protected route. Uses `@CurrentUser(): AuthenticatedUser`. Returns `{ sub, sid, role }`. Every future feature module copies this pattern.

- **`apps/api/test/auth-guards.e2e-spec.ts`** — 8 integration tests, real-Postgres via `app.inject()`:
  1. public `/health/live` + `/auth/register` reachable without a token.
     2–4. protected `/auth/me` with missing / malformed / bogus bearer → 401 `UNAUTHENTICATED`.
  2. protected `/auth/me` with a valid token → 200 `{ sub, sid, role }`.
  3. `@Roles('admin')` on a `user` token → 403 `ROLE_FORBIDDEN` (proves role enforcement).
  4. `@Roles('admin')` on an admin-minted token → 200 (proves positive path — admin token minted directly via `TOKEN_SERVICE` since we don't expose an admin-create endpoint yet).
  5. `@CurrentUser()` without `@Roles` still hydrates `req.user`.

**Files created** (7) — `apps/api/src/common/auth/{authenticated-user,public.decorator,roles.decorator,current-user.decorator,jwt-auth.guard,roles.guard,index}.ts` + `apps/api/test/auth-guards.e2e-spec.ts`.
**Files edited** (3) — `apps/api/src/app.module.ts` (3-guard chain), `apps/api/src/health/health.controller.ts` (+ `@Public()`), `apps/api/src/modules/identity/interface/auth.controller.ts` (+ `@Public()` on the 4 entry routes, + `GET /me` with `@CurrentUser()`).
**Dependencies** — none new; reuses `@app/auth`, `@app/errors`, `IdentityModule.TOKEN_SERVICE`.

**Verification**

- ✅ `tsc --noEmit` green on apps/api.
- ✅ `jest --testPathPattern="auth-guards"` — 8/8 pass.
- ✅ Broader run (`identity|smoke|auth-guards|app.e2e|health` + `filters|rate-limit|zod|security|domain-exception`) — **10 suites, 79 tests pass.** No regression on existing coverage.
- ✅ Guard ordering verified: a public route with no token hits `RateLimitGuard` (passes) → `JwtAuthGuard` (short-circuits on `@Public()`) → `RolesGuard` (short-circuits with no `@Roles`) → handler. A protected route without a token hits `JwtAuthGuard` and throws before the handler runs.

**Acceptance criteria**

- ✅ `JwtAuthGuard` as global APP_GUARD.
- ✅ `RolesGuard` as global APP_GUARD enforcing `@Roles`.
- ✅ `@Public()` exempts specific routes/classes.
- ✅ `@CurrentUser()` extracts `AuthenticatedUser` in handlers.
- ✅ Protected route returns 401 without token.
- ✅ Protected route with wrong role returns 403.
- ✅ `/health/*` + `/auth/{register,login,refresh,logout}` remain public.

**Notes**

- **Why go through `TOKEN_SERVICE` port, not `@app/auth` directly.** The guard lives in `apps/api/src/common/auth/` — app-level code. The `TokenService` port is the seam between crypto primitives and app policy (TTLs, keyrings, issuer/audience, JWKS rotation later). Future-me can swap HS256 → RS256 + JWKS by editing `JwtTokenService` alone; the guard doesn't change. Direct `@app/auth` use would leak the algorithm choice into the guard.
- **Why no Reflector import in the decorators.** `SetMetadata` is framework-built-in; the decorators stay pure metadata. Guards are the only places that need a `Reflector` (DI'd via `@Inject(Reflector)` — the tsx decorator-metadata workaround from `[IV.18.1.16]`).
- **Why the synthetic `GuardTestController` in the test file (not in src/).** Production should not ship an unauthenticated admin probe. Declaring the controller inline in the spec keeps it scoped to test builds.
- **Why `RolesGuard` throws Error instead of ForbiddenError when `req.user` is missing.** That state means `@Roles` is on a `@Public()` route, which is a config bug — loud is correct. `ForbiddenError` would silently return 403 to a caller who should've gotten a route not protected at all.
- **Why `@SkipThrottle()` stays on HealthController alongside `@Public()`.** `@Public()` bypasses auth; `@SkipThrottle()` bypasses rate limits. LB health checks need both.
- **`@Public()` on `/auth/*` is tighter than stacking the whole controller.** The 4 entry routes explicitly opt in; `GET /auth/me` inherits protection by default. This keeps the public surface obvious at the call site.

---

### [III.13.2] — Identity module: register / login / refresh / logout with reuse-detection cascade (part 2)

**Date:** 2026-04-20 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done**

Picked up the second slice of `[III.13.2]` after part 1 (crypto primitives) locked in. This slice wires the primitives into an actual auth flow — a full NestJS Identity module with the load-bearing reuse-detection cascade. Register, login, refresh, logout all work end-to-end against the real PostGIS Postgres through Fastify `app.inject()`.

- **`apps/api/src/modules/identity/`** — clean-hex layers per ADR-001:
  - **`domain/session.entity.ts`** — pure `Session` interface + `isSessionActive()`. No Prisma types leak into domain.
  - **`application/ports/session.repository.ts`** — `SessionRepository` port with `create` / `findByRefreshHash` / `rotate` / `revoke` / `revokeAllForUser`. Symbol DI token. Caller supplies the id so the JWT's `sid` claim matches the persisted row without a round-trip.
  - **`application/ports/user.repository.ts`** — minimal surface: `create` / `findByEmailHash` / `findById`. Soft-deleted users filter out (ADR-010 contract — anonymised users must not resurrect).
  - **`application/ports/token.service.ts`** — `TokenService` port wrapping `@app/auth` sign/verify with access + refresh policy split.
  - **`application/issue-session.use-case.ts`** — generate CSPRNG session id, sign refresh JWT (carries `dfp` device-fingerprint claim), persist `sha256(refreshToken)` only, sign access JWT. Raw refresh token goes to the cookie, never to the DB.
  - **`application/refresh-session.use-case.ts`** — the load-bearing one. 6-step flow: JWT verify → hash lookup → reuse-detection cascade → expiry → sid-mismatch → atomic rotate (old row's `revokedAt` set + new row inserted in one tx). On a revoked-row hit, `revokeAllForUser()` wipes every session for the user — OWASP refresh-rotation pattern.
  - **`application/revoke-session.use-case.ts`** — logout. Idempotent: missing / already-revoked cookies return success silently.
  - **`application/register.use-case.ts`** — argon2id hash, unique-email check via `emailHash`, sha256(EMAIL_PEPPER + email.lowercase). Issues session on success. Full field-level email encryption is queued for `[III.13.11]`; for now we stash utf-8 bytes in `emailEncrypted` (no decryption API is exposed).
  - **`application/login.use-case.ts`** — deliberate uniform-error: wrong email and wrong password both emit `INVALID_CREDENTIALS` at 401. Dummy-hash verify on miss-path equalizes timing. Issues session on success.
  - **`infrastructure/email-hash.ts`** — module-scoped `hashEmail(emailLower)` using `EMAIL_PEPPER` env var (new — see below).
  - **`infrastructure/prisma-session.repository.ts`** — thin Prisma adapter. `rotate()` uses `$transaction` for the revoke-old + insert-new pair (CLAUDE rule 13 preserved — only DB writes in the tx, no network calls).
  - **`infrastructure/prisma-user.repository.ts`** — hides soft-deleted users from both `findByEmailHash` and `findById`.
  - **`infrastructure/jwt-token.service.ts`** — env-derived keyrings (`kid=access-v1` / `kid=refresh-v1`, single-key rings for now), `parseDuration("15m"|"30d"|"12h"|"45s")` utility. JWKS rotation cron + multi-key rings land in their own follow-up.
  - **`interface/auth.controller.ts`** — `POST /api/v1/auth/{register,login,refresh,logout}`. Refresh cookie: `httpOnly`, `sameSite: strict`, `secure` in staging/prod, `path: /api/v1/auth`, `maxAge` mirrors refresh TTL. Access token in JSON body only (CLAUDE rule 12). Device fingerprint = `sha256(pepper + ua + ip)`; `x-device-id` header is **read but ignored** this slice (Session FK → Device, no auto-create yet).
  - **`interface/dto/auth.dto.ts`** — Zod schemas for register + login bodies. Password policy intentionally mild (min 12, max 128); entropy scoring + HIBP k-anon is a follow-up.
  - **`identity.module.ts`** — wires all ports → adapters, declares controller, exports `RefreshSessionUseCase` so downstream modules (JwtAuthGuard) can reuse.

- **`apps/api/src/main.ts`** — registered `@fastify/cookie` after `registerSecurity()` so the httpOnly refresh cookie parses on /refresh + /logout.

- **`apps/api/src/app.module.ts`** — imported `IdentityModule`.

- **`packages/config/src/schema.ts`** — added `EMAIL_PEPPER: z.string().min(32)` under `SecuritySchema`. Playbook §13.11 calls for a dedicated pepper on email/IP hashes so pepper rotation can happen independently of rate-limit pepper rotation.

- **`.env.example` + `apps/api/test/setup.ts`** — seeded `EMAIL_PEPPER`.

- **`apps/api/test/identity.e2e-spec.ts`** — 5 integration tests against real Postgres via `app.inject()` (no port bind):
  1. register → httpOnly cookie set, access token returned, body has userId.
  2. wrong password + unknown email → uniform `INVALID_CREDENTIALS` 401.
  3. refresh rotates — old cookie invalidated, new one works.
  4. **REUSE CASCADE** — register user, open a 2nd login session (total 2 active), rotate session 1 with `/refresh`, replay the (now-rotated) cookie → 401 `REFRESH_REUSE_DETECTED` AND every session for the user is `revokedAt != null`. Proven by `prisma.session.count({ where: { userId, revokedAt: null } })` going 2 → 0.
  5. logout revokes + clears cookie, second logout is a no-op.

**Files created** (15) — `apps/api/src/modules/identity/{domain/session.entity.ts, application/{issue-session,refresh-session,revoke-session,register,login}.use-case.ts, application/ports/{session,user,token}.ts, infrastructure/{prisma-session.repository,prisma-user.repository,jwt-token.service,email-hash}.ts, interface/{auth.controller.ts, dto/auth.dto.ts}, identity.module.ts}` + `apps/api/test/identity.e2e-spec.ts`.
**Files edited** (5) — `apps/api/src/main.ts` (cookie plugin), `apps/api/src/app.module.ts` (IdentityModule), `apps/api/test/setup.ts` (EMAIL_PEPPER), `.env.example` (EMAIL_PEPPER), `packages/config/src/schema.ts` (EMAIL_PEPPER).
**Dependencies added** — `@fastify/cookie@11.0.2` on apps/api, `@app/auth@workspace:*` linked into apps/api.

**Verification**

- ✅ `tsc --noEmit` green on apps/api after the new module landed.
- ✅ `jest --testPathPattern="identity|smoke"` — **30/30 pass**: identity 5/5, phase-0 smoke 25/25.
- ✅ Full-suite earlier run: 80/81 pass. The one fail is a pre-existing parallel-test data collision between `index-usage.e2e-spec.ts` (seeds places near Victoria in `beforeAll`, cleans only in `afterAll`) and `geo-queries.e2e-spec.ts` (also queries near Victoria). Both prompts are `[III.12.x]` — unrelated to this slice. Fix is queued as a test-hygiene follow-up.
- ✅ All clean-hex boundaries hold: `domain/` has no framework imports, `application/` talks only to ports, adapters implement those ports, interface layer is a thin controller.

**Acceptance criteria**

From the `[III.13.2]` full scope, this slice covers:

- ✅ Register + login with argon2id password hashing — land.
- ✅ Access JWT 15m + refresh JWT 30d in httpOnly+SameSite=strict cookie on `/api/v1/auth` — land.
- ✅ Rotating refresh + reuse-detection cascade (the load-bearing acceptance criterion) — **proven by integration test**.
- ✅ Session repo (Prisma) — land.

Still deferred to follow-ups under the same IN-PROGRESS banner:

- ⏳ TOTP MFA (speakeasy) + MFA-required login flow.
- ⏳ OAuth2 Google/Apple via Passport — env vars already in schema.
- ⏳ JWKS rotation cron + multi-key keyring persistence.
- ⏳ Session concurrency cap (10/user).
- ⏳ Device fingerprint binding on refresh (today's `dfp` is computed fresh per request — should be bound to the session on issuance and compared on refresh).
- ⏳ Device table auto-create so `x-device-id` persists to `Session.deviceId`.
- ⏳ Field-level encryption on `emailEncrypted` (queued for `[III.13.11]`).
- ⏳ `JwtAuthGuard` + `RolesGuard` + `@CurrentUser()` decorator (`[III.11.3]` picks these up on top of the `TokenService` port).

**Notes**

- **Why separate opaque random + JWT refresh tokens was rejected.** Some auth stacks keep a random cookie value and a separate JWT. We use the JWT itself as the cookie value (stored as its sha256). The `dfp` claim + hash-lookup + reuse cascade covers the same threat model; double-token plumbing is dead weight for v1.
- **Why the controller has no `@Throttle` decorator.** @nestjs/throttler v6 stacks all named buckets when no override is present — so the auth route correctly inherits default (60/min) AND auth (5/min), smallest wins = 5/min in prod. Explicit `@Throttle({ auth: {...} })` would OVERRIDE test-mode limit inflation and trip 429s in the integration suite.
- **Why `fastify/cookie` registers after `registerSecurity`.** Helmet hardens headers before routes bind; cookie parser attaches a decorator that needs the Fastify instance. Ordering keeps both working and keeps the refresh cookie off the `/health` surface via `path: /api/v1/auth`.
- **Why the Device FK is nullable in the session.** The Session model has `deviceId String?` with `onDelete: SetNull`. A dedicated `RegisterDeviceUseCase` prompt will populate Device rows from the `x-device-id` header and then we can switch the FK to non-null.
- **ADR-010 contract met.** Both `UserRepository` methods filter on `deletedAt IS NULL` so anonymised users can't log in or resurrect.

---

### [III.13.2] — @app/auth crypto primitives (foundation only — part 1 of the auth prompt)

**Date:** 2026-04-20 · **Status:** IN-PROGRESS · **Kind:** Build · **Playbook §** 13.2

**What was done — scope reduction explained**

`[III.13.2]` is the single biggest prompt in the Playbook — argon2id + access+refresh JWT + rotating refresh + reuse-detection + TOTP MFA + OAuth2 Google/Apple + JWKS key rotation + session concurrency cap + device fingerprint binding + full integration tests. That's 5+ subsystems of security-critical code, a 3–5 hour focused task at minimum.

In Plan-first mode, a responsible autopilot doesn't ship half of that. Shipping a half-implemented auth flow is WORSE than no auth — it creates the illusion of security. So this commit is **part 1 only: the cryptographic primitives**. Pure functions, no DI, no DB, no HTTP — isolated and heavily tested. The Nest module + Prisma user repo + HTTP endpoints + OAuth + MFA + JWKS rotation + device binding + session cap all land in follow-up prompts on top of THIS foundation.

- **`packages/auth/`** — new workspace package, `@app/logger`-pattern shape.
  - **`src/password.ts`** — `hashPassword(plaintext)` / `verifyPassword(plaintext, hash)` / `needsRehash(hash)`. argon2id at Playbook §13.2 cost parameters (timeCost 3, memoryCost 64 MiB, parallelism 1). `needsRehash` reads the params out of the stored hash prefix so we can bump work factors later without a flag day — re-hash-on-login migration. Salt is random per hash (16 bytes). Empty-plaintext + malformed-hash inputs return `false` without throwing (never leak timing or implementation details on bad input).
  - **`src/jwt.ts`** — `signJwt(claims, key, {expiresInSeconds, issuer?, audience?})` + `verifyJwt<T>(token, keyring, opts?)`. Every token carries a `kid` protected header; verify tries `keyring.current` then each `keyring.previous` until a match. `JwtVerificationError` with stable codes `MISSING_KID` | `UNKNOWN_KID` | `INVALID`. HS256 today — RS256/ES256 + JWKS endpoint is a signer-swap follow-up, protocol shape already future-proof. `AccessTokenClaims` + `RefreshTokenClaims` typed so use-cases can't mix them up. `secretFromString(string)` utility for building `JwtKey.secret: Uint8Array` from env.
  - **`src/index.ts`** — re-exports. Header comment lists what's here (password + JWT) vs. what's NOT YET here (refresh rotation, MFA, OAuth, JWKS rotation cron, Nest guards, session cap, device binding) so future prompts have a clear starting line.
- **`test/password.spec.ts`** — 11 tests covering argon2-prefix-format assertion, salt-randomness, empty-input rejection, round-trip, non-match false, malformed-hash safe-false, hash-empty defensive throw, and `needsRehash` across current/old-cost/unrecognised-format inputs.
- **`test/jwt.spec.ts`** — 11 tests covering access + refresh round-trips, issuer + audience propagation + mismatch rejection, key rotation (sign with `v1`, verify when keyring has `v2` current + `v1` previous), `UNKNOWN_KID` when `v1` is rotated out, `MISSING_KID` on a header without kid, `INVALID` on tampered signatures + expired tokens, `JwtVerificationError.code` + name stability, `secretFromString` UTF-8 encoding.

**Files created** (11) — `packages/auth/{package.json, tsconfig.json, tsconfig.build.json, jest.config.cjs, eslint.config.mjs}` + `src/{password,jwt,index}.ts` + `test/{password,jwt}.spec.ts`.
**Files edited** (1) — `pnpm-lock.yaml` (workspace + deps).
**Dependencies** — `argon2@^0.41.1` (native binding), `jose@^5.9.6` (modern JWT + JWKS-native). Both CJS-friendly; no ESM/ts-jest friction. Coverage threshold tightened to 85% (vs workspace 80%) since this is security-critical code.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest --runInBand` — **22/22 pass** (11 password + 11 JWT). Covers the 4 error paths on `verifyJwt` (MISSING_KID, UNKNOWN_KID, INVALID-signature, INVALID-expired) and the rotation happy-path.
- ✅ `tsc -p tsconfig.build.json` emits `dist/`.

**Acceptance criteria**

Partial — scope is the foundation layer only:

- ✅ argon2id at timeCost 3 + memoryCost 65536 (verified via hash-format assertion in tests).
- ✅ `kid` header on every JWT (part of the sign contract; verify asserts).
- ✅ Keyring shape supports current + previous during rotation — tests prove a `v2`-current, `v1`-previous keyring accepts tokens signed with EITHER.

Deferred to follow-up prompts (each marked IN-PROGRESS until they land):

- ⏳ Access JWT 15m + refresh JWT 30d in httpOnly cookie — needs Nest + Fastify cookie plugin wiring.
- ⏳ Rotating refresh + reuse-detection cascade — needs a Session repo (Prisma).
- ⏳ TOTP MFA — needs speakeasy + a User MFA-status field.
- ⏳ OAuth2 Google/Apple — needs Passport strategies + env vars already in schema.
- ⏳ JWKS rotation cron — needs BullMQ + Redis-backed keyring storage.
- ⏳ Session concurrency cap (10) — needs Session repo.
- ⏳ Device fingerprint binding — trivially added once refresh flow exists.

**Notes**

- **Why jose over jsonwebtoken.** jose ships both CJS + ESM, has first-class JWKS primitives (`createLocalJWKSet`), and its `SignJWT` / `jwtVerify` API is cleaner. `jsonwebtoken` would work but its JWKS story is third-party (jwks-rsa).
- **Why explicit argon2 params.** Playbook §13.2 names exact values; argon2's defaults differ. Pinning ensures a hash generated on pod A verifies correctly on pod B at the same cost factor. When we bump the factor, `needsRehash` drives the migration one login at a time.
- **Why `JwtVerificationError` instead of jose's native errors.** Callers need a stable `code` to branch on — `MISSING_KID` / `UNKNOWN_KID` / `INVALID` cover the real auth decisions (return 401 + "please log in", return 401 + "token from retired key rotation", return 401 + "malformed"). jose's specific error classes (`JWSSignatureVerificationFailed`, `JWTExpired`, etc.) leak too much internal detail into the call-site.
- **No integration test yet.** Integration tests for the crypto layer alone would be noise; the real integration test is "register a user, log in, refresh the token, log out" — which requires the Nest module + Prisma repo, i.e. the next prompt's work. The unit tests here cover every branch with real argon2 hashing + real jose signing.
- **Security-sensitive code deserves a real human review** before the Nest integration lands on top. The foundation is small (200 lines); worth reading line-by-line before building the stack on it.

---

### [IV.18.1.9] — @app/events: typed EventBus + Redis Streams adapter + DLQ + in-memory for tests

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 6.4 · **ADR** [ADR-003](./docs/adr/ADR-003-event-backbone.md)

**What was done**

The last meaningful Phase-0 infrastructure piece. ADR-003 committed us to Redis Streams as the event backbone; the context-map lists every module's inbound/outbound events. This package turns those commitments into code that every future Phase-1 module can call.

- **`packages/events/`** — new workspace package, `@app/logger`-pattern shape (CJS `dist/` output, scripts, configs). 6 source files:
  - **`src/event.ts`** — `DomainEvent<TPayload>` canonical shape: `name` (e.g. `Trip.TripDrafted` per context-map naming), `id`, `version`, `occurredAt`, `traceId?`, `payload`. Plus `DomainEventWire` (ISO-string `occurredAt` on the wire) and `DomainEventOfName<TName, TPayload>` for subscribers who want to pin.
  - **`src/event-bus.ts`** — the `EventBus` port. `publish<TPayload>(event)`, `subscribe<TPayload>(name, handler, options?)`, `close()`. `SubscribeOptions` carries `consumerGroup` + `deadLetterAfterAttempts` (default 3). Returns a `Subscription { eventName, consumerGroup, unsubscribe() }`. `EVENT_BUS` DI token as a `Symbol.for(...)`.
  - **`src/in-memory-event-bus.ts`** — in-process adapter for tests. Synchronous dispatch per consumer group, retries on failure, accumulates failed events in a `drainDlq()` accessor.
  - **`src/redis-streams-event-bus.ts`** — **production adapter**. Separate publisher + per-consumer `.duplicate()` connections (XREADGROUP BLOCK can't share a connection with XADD). `XGROUP CREATE ... MKSTREAM` idempotent (BUSYGROUP handled). Consumer loop `XREADGROUP` + `XACK` on success; on failure retries up to `deadLetterAfterAttempts`, then `XADD`s to `<stream>:dlq` before acking the main stream. Keys: `<keyPrefix><eventName>` (e.g. `travel-prod:events:Trip.TripDrafted`). Shutdown flips stop flags, awaits in-flight loops, quits both clients.
  - **`src/index.ts`** — re-exports. Swap-to-Kafka path documented in header comment: implement `KafkaEventBus: EventBus`, bind to `EVENT_BUS` — zero domain-code changes (ADR-003 migration triggers spell out when).
- **`test/in-memory-event-bus.spec.ts`** — 6 unit tests: single-subscriber delivery, multi-consumer-group fan-out, unsubscribe, DLQ on retries exhausted, publishing-without-subscribers is a no-op, close rejects further publishes.
- **`test/redis-streams-event-bus.e2e-spec.ts`** — 3 integration tests against real Docker Redis:
  1. **One event → two consumer groups**. `notifications` + `analytics` both receive it (proves independent-group semantics).
  2. **Forced-fail DLQ**. Handler throws on every call; after 3 attempts the event lands in `<stream>:dlq` with `attempts=3` + `lastError=forced-fail` + `originStream` fields. Verified by `XRANGE`.
  3. **Competing consumers in the same group**. Two handlers in `one-group`, publish 4 events, assert total received = 4 (each event delivered exactly once across the group — Redis Streams's competing-consumer semantics).
- Unique per-test `keyPrefix` (`events-test-${pid}-${Date.now()}:${uuid}:`) so parallel + repeat runs can't contaminate each other's streams.

**Files created** (11) — `packages/events/package.json` + 5 configs (`tsconfig.json`, `tsconfig.build.json`, `jest.config.cjs`, `eslint.config.mjs`) + `src/{event,event-bus,in-memory-event-bus,redis-streams-event-bus,index}.ts` + 2 test files.
**Files edited** (1) — `pnpm-lock.yaml` (workspace registration).
**Dependencies** — `ioredis` (production dep, already in root); `@nestjs/common` optional peer + dev dep; `@app/logger` + `@app/tsconfig` + `@app/eslint-config` workspace deps.

**Verification**

- ✅ `tsc --noEmit` green for `packages/events`.
- ✅ `jest --runInBand` in `packages/events` — **2 suites, 9/9 tests pass**.
- ✅ Full `apps/api` suite — **11 suites, 76/76** — no regressions from adding the new workspace package.
- ✅ `tsc -p tsconfig.build.json` produces a clean `dist/` ready for other packages to consume.

**Acceptance criteria**

- ✅ Typed `EventBus` interface with `publish<E>(event)` + `subscribe<E>(name, handler)`.
- ✅ Redis Streams adapter with consumer groups per module.
- ✅ Dead-letter stream: forced-fail event lands in `<stream>:dlq` after retries exhausted (verified via `XRANGE`).
- ✅ In-memory adapter for tests — 6/6 unit tests pass.
- ✅ Swap-to-Kafka path documented: implement `KafkaEventBus: EventBus`, bind at `EVENT_BUS`, ADR-003 migration triggers are the gate. No domain changes.

**Notes**

- **Why separate publisher + per-consumer connections?** `XREADGROUP BLOCK 5000` holds its Redis connection for the full 5-second block window. Sharing that connection with `XADD` (publish) means every publish stalls for up to 5s waiting for the read to return. Each consumer gets its own `this.publisher.duplicate()` — one idle connection per subscription is the right trade.
- **Competing consumers vs independent groups.** This is the whole reason for named consumer groups. `notifications` and `analytics` are different groups — each one gets every event. Two handlers in the SAME group `one-group` are competing consumers — each event goes to exactly one of them. Both patterns are tested.
- **DLQ key structure.** `<originStream>:dlq`. Fields: `data` (original wire JSON), `consumerGroup`, `attempts`, `lastError`, `originStream`. Retained forever by default; ops clears via `XDEL` or trims with `XTRIM`. Matches context-map's "7-day DLQ retention" default from [ADR-003] — the trim policy is an ops concern, not a code concern.
- **No NestJS module wired yet.** The `EVENT_BUS` token exists; consumers inject it. A small `EventsModule.forRoot({ redisUrl, keyPrefix })` wrapper is the natural follow-up — but trivial and un-controversial. Left for the first prompt that actually needs it (likely `[IV.18.2.x]` when the first module publishes an event).
- **Swap-to-Kafka path.** Adapter-pattern + token-based DI means the migration is one file swap + one DI binding change. ADR-003's triggers (>30k ev/s for 7d, cross-region fan-out, long retention, Schema Registry needs) decide when.
- **ioredis Lua-free.** The adapter doesn't use a Lua script — each op is a separate ioredis call. Redis handles consistency per-op; at-least-once semantics don't need atomicity across multiple ops for this adapter. (Contrast with `RedisThrottlerStorage` which DOES use Lua — sliding-window atomicity is different.)

---

### [II.8.6] — ADR-009 DevOps & infra lock + quantitative K8s triggers

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.6 + 34.3

**What was done**

Fills the ADR-009 gap in the index (previously jumped 008 → 010) and locks the deploy/operate surface. The four sibling stack-lock ADRs (005 frontend, 006 backend, 007 data, 008 AI) covered libraries + runtimes; this one pins hosting, CI/CD, CDN, secrets, and — load-bearing — the **quantitative** K8s migration tripwire the prompt's acceptance demands.

- **`docs/adr/ADR-009-devops.md`** — MADR, 5 choices × 5 rejected alternatives:
  - pnpm 9 + Turborepo 2 / rejected npm workspaces + Nx (extra DSL surface).
  - Fly.io primary + Railway fallback / rejected AWS ECS day-one (2-week stand-up vs 1-hour ship).
  - GitHub Actions + Turbo remote cache + Buildx + Trivy / rejected CircleCI/GitLab CI (integration delta with GitHub beats feature delta).
  - Cloudflare CDN+WAF / rejected AWS CloudFront + WAF + Route 53 (TCO + dashboards).
  - Doppler secrets / rejected AWS Secrets Manager day-one (DX — need AWS acct before `pnpm dev`).
- **Kubernetes migration triggers** spelled out as numbers, per the acceptance criterion:
  1. ≥ 4 regions serving real traffic AND aggregate MAU ≥ 500,000.
  2. Monthly hosting bill > $15,000 AND > 40% of COGS (per [§23.1]). Caveat: false-positive on trigger 2 alone usually means a cost bug, not an infra ceiling — root-cause before superseding.
  3. Self-hosted LLM inference > 100 req/s sustained 24 h AND Fly GPU price > 2× EKS spot equivalent.
  4. Custom networking Fly's anycast + WireGuard mesh can't serve (bounded, not aesthetic).
- **Re-evaluation triggers** (separate from the K8s tripwires): Fly SLA incident density, Cloudflare free-tier pricing shifts, GitHub Actions minute quota burn, Doppler SOC 2 posture vs CMK requirements.
- **Binding consequences** re-encode several operational rules: `pnpm install --frozen-lockfile` in CI, distroless + non-root Docker images, `.env` gitignored + Doppler-owned secrets (CLAUDE rule 5 tie-in), SBOM + Trivy hard-block on CRITICAL CVE, Terraform + Helm scaffolds live in `infra/` ready-but-unused until triggers fire, no auto-upgrades on paid tiers (human confirms).
- **`docs/adr/README.md`** — row for ADR-009, inserted in numeric order so the index finally reads 001..010 contiguous.

**Files created** (1) — `docs/adr/ADR-009-devops.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance criterion: "K8s migration triggers are quantitative." ✅ — 3 numeric triggers (region count + MAU floor; $/month + COGS %; req/s + cost ratio) + 1 architectural (custom networking), all checkable against metrics we'd already be emitting via the OTel stack from `[III.15.4]`.

Cross-checks:

- Every choice reconciles with prior ADRs — pnpm + Turborepo match the actual `pnpm-workspace.yaml` + `turbo.json` shipped in `[II.10.0]`; Fly.io matches the Playbook §34.2 hosting table; Cloudflare matches Playbook §8.6.
- Binding consequences align with CLAUDE.md rules (rule 5 secrets, rule 9 logger/no-console in Docker image) + the Playbook §21.4 budget-alarm posture.
- ADR-009 number gap closed; index is now 001..010 contiguous.

**Acceptance criteria**

- ✅ DevOps stack locked (pnpm + Turborepo + Docker + Fly.io/Railway v1 + Terraform-ready for AWS).
- ✅ K8s migration triggers are quantitative (3 numeric + 1 architectural, each binding).

**Notes**

- **Why a separate ADR for "Infra v1" + "Infra later" instead of one per region?** Because the Infra-later path is the SAME Dockerfile + SAME Terraform scaffold + SAME Helm chart — just on a different control plane. One ADR captures the posture ("small team deploys on managed, graduates to AWS when triggers fire"); doesn't require a follow-up for the target.
- **Trigger 2's false-positive caveat** is practical operations advice: a team that crosses $15k/month WITHOUT crossing trigger 1 or 3 is usually leaking money (unbounded PostHog captures, CDN cache-miss storms, forgotten staging envs). The ADR refuses to ratify EKS adoption on trigger 2 alone without a cost-cause investigation first — saves us from a migration-as-cope anti-pattern.
- **Stack-lock series complete.** 005 (frontend) + 006 (backend) + 007 (data) + 008 (AI) + 009 (devops). Any significant architectural drift now requires a superseding ADR, not a PR-comment thread.

---

### [III.15.4] — OpenTelemetry tracing: NodeSDK + Prisma instrumentation → Jaeger

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 15.4

**What was done**

Replaced the `[IV.17.6]` no-op `instrumentation.ts` stub with the real SDK. Traces for every HTTP request now flow `api → OTLP/HTTP → Jaeger` with a full span tree including Prisma engine db_query spans.

- **`packages/observability/`** — upgraded from placeholder to a real CJS-shaped package (matches the `@app/logger` pattern). Rewrote `package.json` (removed `"type": "module"`, added `main`/`types`/`exports` pointing at `dist/`, scripts, deps). Added `tsconfig.json`, `tsconfig.build.json`, `jest.config.cjs`, `eslint.config.mjs`.
- **`packages/observability/src/tracing.ts`** — `createSdk(opts)` assembles a `NodeSDK` with:
  - `OTLPTraceExporter({ url: "${endpoint}/v1/traces" })` — endpoint from `OTEL_EXPORTER_OTLP_ENDPOINT` env, default `http://localhost:4318` (Jaeger OTLP HTTP).
  - `new Resource({ service.name, service.version, deployment.environment })` — resource attributes land as span tags in Jaeger.
  - `getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false }, '@opentelemetry/instrumentation-dns': { enabled: false } })` — fs + dns are noisy; every other auto-instrumentation stays on (http, fastify, nest, ioredis, undici, pg, etc.).
  - `new PrismaInstrumentation()` — Prisma's spans are NOT included in `auto-instrumentations-node`; must be registered explicitly. Pinned to `@prisma/instrumentation@5.22.0` to match our `@prisma/client` version exactly.
- **`packages/observability/src/init.ts`** — `initTracing(serviceName, opts?)`. Idempotent (re-calls are no-ops). Respects `OTEL_DISABLED=true` (skips SDK start + logs one warn — useful for local runs without Jaeger). SIGTERM handler flushes + shuts down the SDK so graceful pod termination doesn't lose in-flight spans. Explicit `shutdown()` export + `__resetForTests()` for unit tests.
- **`apps/api/instrumentation.ts`** — replaces `export {};` with `initTracing('api', { serviceVersion: process.env['npm_package_version'] ?? '0.0.0' })`. Still the VERY FIRST import in `main.ts` — the load-order contract was there from day one so nothing else changed.
- **`apps/api/prisma/schema.prisma`** — `previewFeatures = ["postgresqlExtensions", "tracing"]`. The `tracing` flag activates Prisma's OTel integration; without it the `PrismaInstrumentation` registers but receives no events from the client. Requires `prisma generate` to take effect.
- **`apps/api/package.json`** — adds `@app/observability: workspace:*`.

**Files created** (6) — `packages/observability/src/{tracing.ts, init.ts, index.ts}` + configs (`tsconfig*`, `jest.config.cjs`, `eslint.config.mjs`).
**Files edited** (4) — `packages/observability/package.json`, `apps/api/instrumentation.ts`, `apps/api/prisma/schema.prisma`, `apps/api/package.json`, `pnpm-lock.yaml`.
**Dependencies** — `@opentelemetry/{api, sdk-node, auto-instrumentations-node, exporter-trace-otlp-http, resources, semantic-conventions}`, `@prisma/instrumentation@5.22.0` — all on `@app/observability`.

**Verification**

- ✅ `tsc --noEmit` green (both `apps/api` and `@app/observability`).
- ✅ Full api suite — **11 suites, 76/76** (OTel doesn't load in tests — `instrumentation.ts` is only imported by `main.ts`).
- ✅ **Live smoke against Jaeger:**
  - Boot `apps/api` with `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`.
  - `curl /health/live` → Jaeger's `/api/services` lists `["api"]`.
  - `curl /health/ready` repeatedly → Jaeger shows operations including `GET /health/ready`, `prisma:client:operation`, `prisma:client:serialize`, **`prisma:engine:db_query`** (the Prisma engine SQL call), `prisma:engine:response_json_serialization`, plus the full Fastify middleware chain, ioredis `ping`, etc.
  - Resource tags on every span: `service.name = api`, `service.version = 0.0.0`, `deployment.environment = development`.

**Acceptance criteria**

- ✅ Jaeger UI shows a full span tree for one request — `GET /health/ready` fans into 20+ child spans.
- ✅ Prisma query spans appear — `prisma:engine:db_query` explicitly present.

**Notes**

- **Windows + OneDrive + Prisma regen.** `prisma generate` fails with `EPERM` renaming `query_engine-windows.dll.node` if OneDrive is syncing `node_modules`, regardless of whether the api is running. Workaround for this session: stopped the api, `rm -f` the DLL, re-ran `prisma generate` — clean regen. Long-term fix: exclude `node_modules/` from OneDrive sync. Noted in the `tracing.ts` header comment for future engineers.
- **Prisma 5 vs Prisma 7 instrumentation.** `npx pnpm add @prisma/instrumentation` initially resolved to 7.7.0. With a Prisma 5.22 client, the 7.x instrumentation ran but didn't tag any spans (the internal hook surface shifted). Pinned to `@prisma/instrumentation@5.22.0` to match `@prisma/client@5.22.0` — spans appeared immediately.
- **`getNodeAutoInstrumentations` gotcha.** `fs` and `dns` are on-by-default and flood the tracer with `read`, `stat`, and `tcp.connect` spans for every Node `require()`. Disabled both — keeps the tree readable and costs nothing in observability (file reads aren't interesting).
- **First-batch 404 on SDK startup.** NodeSDK emits a lifecycle event that the exporter tries to flush before the app has completed boot, sometimes racing Jaeger's readiness and landing a 404. It's transient and doesn't affect post-boot spans. Left as-is; will re-evaluate if it shows up in prod logs.
- **CI implication.** The Phase-0 smoke workflow does not run with Jaeger available. `OTEL_EXPORTER_OTLP_ENDPOINT` is unset in the CI env, so the exporter falls back to `localhost:4318` and fails — but the failure is silent (OTel logs warn; the app keeps running). Tests don't load `instrumentation.ts`, so CI stays green. Production pods will have the real endpoint injected by Doppler.
- **Log order inside `instrumentation.ts`.** The whole file is a single function call + `export {};`. Exporting ensures TS treats it as a module and doesn't hoist anything past the `initTracing` call.

---

### [III.11.4] — Redis sliding-window rate limiter

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 11.4 + §13.4

**What was done**

Custom `@nestjs/throttler` storage backed by a Redis sorted-set sliding window. Three named buckets wired (`default` 60/min, `ai` 10/min, `auth` 5/min). Keys peppered with `RATE_LIMIT_PEPPER` so raw IPs / user-ids never sit in Redis in plaintext (§13.4).

- **`apps/api/src/common/rate-limit/redis-throttler.storage.ts`** — implements `ThrottlerStorage`. Single Lua script does `ZREMRANGEBYSCORE` (trim out-of-window) + `ZADD` (record current) + `ZCARD` (count) + `PEXPIRE` + `ZRANGE 0 0 WITHSCORES` (oldest entry for `timeToExpire`). All atomic. Uses ioredis with `lazyConnect`, `enableOfflineQueue: false` — same pattern as the Redis health indicator. Keys: `travel-<env>:throttle:<bucket>:sha256(pepper + tracker)`.
- **`apps/api/src/common/rate-limit/rate-limit.guard.ts`** — extends `ThrottlerGuard`, overrides `getTracker` to key by `user:<id>` when authenticated, falling back to `ip:<remote>`. Storage re-hashes with the pepper before touching Redis.
- **`apps/api/src/common/rate-limit/rate-limit.module.ts`** — inner `RateLimitStorageModule` provides `RedisThrottlerStorage` + aliases it to the `ThrottlerStorage` symbol. The outer `RateLimitModule` calls `ThrottlerModule.forRootAsync` with that inner module in its `imports:` so the factory can inject the storage (v6's `extraProviders` option was removed — this is the scoping pattern that replaces it). Test-mode inflates limits 10,000× so cumulative test traffic doesn't trip the shared-IP bucket; per-route `@Throttle({ ai: { limit: 10 } })` overrides stay authoritative.
- **`apps/api/src/app.module.ts`** — imports `RateLimitModule`, registers `RateLimitGuard` globally via `APP_GUARD`. Every route inherits the `default` bucket; routes with `@Throttle({ ai: ... })` get the ai bucket layered on; `@SkipThrottle({ name: true })` removes a specific bucket from a route.
- **`apps/api/src/health/health.controller.ts`** — `@SkipThrottle()` on the class. Probes from k8s / Fly.io hit /health/\* every second; without this the default bucket would trip and flip every pod to Unhealthy every minute.
- **`apps/api/test/rate-limit.e2e-spec.ts`** — 2-test integration suite:
  1. 11th call on an `@Throttle({ ai: { limit: 10, ttl: 60_000 } })` route returns 429 with `Retry-After-ai` set. Calls 1–10 return 200.
  2. The `default` bucket (60/min) is NOT exhausted by those 11 hits — proves bucket isolation. Uses per-pid IP (RFC 5737 TEST-NET-3) so the window starts fresh on every jest invocation.

**Files created** (4) — `apps/api/src/common/rate-limit/{redis-throttler.storage,rate-limit.guard,rate-limit.module}.ts`, `apps/api/test/rate-limit.e2e-spec.ts`.
**Files edited** (3) — `apps/api/src/app.module.ts`, `apps/api/src/health/health.controller.ts`, `apps/api/package.json`.
**Dependencies** — `@nestjs/throttler@6.5.0`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest test/rate-limit.e2e-spec.ts --runInBand` — **2/2**.
- ✅ Full api suite — **11 suites, 76/76** (up from 74/74).
- ✅ Atomicity: Lua script's 5 operations run as one Redis transaction — no race between count and increment.

**Acceptance criteria**

- ✅ Custom `ThrottlerStorage` backed by Redis sliding window (`ZADD` / `ZREMRANGEBYSCORE` / `ZCARD`).
- ✅ Per-IP, per-user, per-endpoint-class buckets — tracker logic in `RateLimitGuard`.
- ✅ `@Throttle({ ai: { limit: 10, ttl: 60_000 } })` maps to an `ai` bucket.
- ✅ Integration test proves 11th call returns 429 (via `ThrottlerException` → `RateLimitError`-ish, HTTP 429 + `Retry-After-ai`).

**Notes**

- **v6 stacks throttlers on every route by default.** `@Throttle({ ai: {...} })` overrides the `ai` bucket's config for that route but `default` and `auth` still apply. To scope a route to ONE bucket, `@SkipThrottle({ other: true, also: true })` is required. The rate-limit test documents this explicitly — it bit me mid-implementation and would bite any future route author.
- **`setHeaders: true`** is needed for `X-RateLimit-*` + `Retry-After*`. Off by default in v6. Header name is `Retry-After-<throttlerName>` for non-default buckets (so blocked AI returns `Retry-After-ai`, not the standard `Retry-After`).
- **Test-mode limit inflation.** 76/76 tests pass because non-rate-limit tests don't trip the shared-IP (127.0.0.1) `default` bucket at 10_000 × 60 limit. The rate-limit test uses a per-pid RFC-5737 IP and an explicit `@Throttle` override, so the inflation doesn't touch its correctness.
- **`@SkipThrottle()` on HealthController** matters operationally, not just for tests. k8s liveness probes fire every 1–10 s; without the skip, probes would exhaust the default bucket in a minute on any pod that sees a health-probe loop.
- **CLAUDE rule 12 (pepper raw PII keys)** satisfied — the storage hashes the tracker before it touches Redis.
- **Dep-cycle detour.** First cut registered `RedisThrottlerStorage` as a provider of `RateLimitModule` and injected it into `ThrottlerModule.forRootAsync`'s factory — DI fails at compile because `forRootAsync`'s factory scope is the `ThrottlerModule`, not its parent. Fix: split into `RateLimitStorageModule` (provides storage) + `RateLimitModule` (imports both). v6 removed `extraProviders`; the inner-module pattern replaces it.

---

### [III.12.6] — ADR-010 delete policy (anonymise-on-delete, no soft-delete middleware)

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Design · **Playbook §** 12.6 + 30.2

**What was done**

Chose **option B — anonymise-on-delete, no soft-delete middleware** — after the user asked for my call, framing the tension as "some want their data kept, some want it gone."

The key insight baked into the ADR: those two cohorts don't need the same mechanism. "Want data kept" = dormancy (account hidden, data untouched, reversible). "Want it gone" = GDPR/DPDP erasure (irreversible, schema-wide anonymisation). Option A fails BOTH — it leaves real PII on disk for regulators to find, and it hides deleted users' contributions from their co-travellers in group trips. Option B serves both correctly when paired with a separate "deactivate" primitive (lands with the identity module, `[III.13.2]`).

- **`docs/adr/ADR-010-soft-delete-policy.md`** — full MADR. Context drivers + considered options (A, B, + a hybrid C named and rejected) + decision outcome + **per-model propagation plan** listing every context's action on `Identity.UserDeleted`:
  - Identity: overwrite PII on `User`; cascade delete `Session` / `Preferences` / `Device`.
  - Trip + Social: retain rows, anonymise `authorId` / reviewer, LLM-sanitise Review bodies (§30.2).
  - Media: hard-delete owned assets + 30-day S3 archival.
  - Payments: retain 7 years (legal) with `userId` scrubbed; Stripe sub cancelled.
  - Safety: retain SosEvent for pattern analysis 12 months with userId blanked; ScamReport + Agent anonymised.
  - Notifications + Live: hard-delete (cascade).
  - Places / Stays / Food / Events / Weather / Transport / Analytics / Admin: no user-scoped rows; unaffected.
- **`docs/adr/README.md`** — index row for ADR-010 (number jumps past 009; [II.8.6] DevOps lock hasn't been done yet, so ADR-009 is still a stub).

**Files created** (1) — `docs/adr/ADR-010-soft-delete-policy.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Acceptance criteria**

- ✅ ADR-010 committed with a chosen outcome (B) and an explicit list of affected models.
- ✅ Rationale cites Playbook §12.6 + §30.2 + ADR-003 (the event bus that carries `UserDeleted`).

**Notes**

- **Why not A even though the user's first instinct was A.** A soft-delete flag does NOT satisfy GDPR / DPDP — regulators read "row still exists with a flag" as "still processing personal data". Users who actively hit DELETE mean "erase". Users who DON'T want data gone simply DON'T hit delete — they stay active (or hit DEACTIVATE, a separate primitive). The flag-everywhere pattern is a tax that serves no cohort properly.
- **Recoverability trade-off.** Under B, a deleted account cannot be restored from DB state — anonymised columns are permanently gone. The mitigation is the **30-day grace window** between anonymisation and hard-purge: within those 30 days an operator can rescind the delete (account un-anonymises at the identity-owning-user's request, but fields must be re-supplied — we don't hold the pre-delete PII anywhere). This is the GDPR-correct shape; "delete means delete" is the spirit of the law.
- **`User.deletedAt` stays the ONE soft-delete column.** Adding any other `deletedAt` now requires a superseding ADR — tripwire locked.
- **`Identity.UserDeleted` is already in the context-map.** Every user-scoped context's "Inbound" column lists it ([docs/architecture/context-map.md]). ADR-010 ratifies the existing event-name commitment.
- **Implementation work** lives in `[VI.30.2]` (the erasure propagation worker) and `[III.13.2]` (the identity module, which adds deactivation as a separate primitive). Those prompts read this ADR's per-context propagation table as spec.

---

### `health-indicator-cleanup` — PostgresHealthIndicator → PrismaService

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Refactor · **Follow-up to** `[IV.18.1.16]` × `[III.12.2]`

**What was done**

`PostgresHealthIndicator` had been carrying its own `pg.Pool` since it was written in `[IV.18.1.16]` — Prisma wasn't wired yet then. Now that `PrismaService` exists (from `[III.12.2]`), the right posture is ONE pool: `/health/ready` probes through the same connection every request path uses. A probe "up" truly means "every incoming request can reach the DB."

- **`apps/api/src/health/indicators/postgres.indicator.ts`** — rewritten to inject `PrismaService`, probe via `$queryRaw\`SELECT 1 AS ok\``. Dropped the `pg.Pool`+ its`onModuleDestroy` cleanup (PrismaService handles that now).
- **`apps/api/package.json`** — removed `pg@8.20.0` + `@types/pg@8.20.0`. Nothing in `apps/api/src` or `apps/api/test` imports `pg` after the rewrite.
- **No test changes needed.** `health.e2e-spec.ts` uses `overrideProvider(PostgresHealthIndicator)` with a test double — the underlying client swap is opaque to it.

**Files created** — none.
**Files edited** (3) — `apps/api/src/health/indicators/postgres.indicator.ts`, `apps/api/package.json`, `PROGRESS.md`.
**Dependencies** — **net -2** (`pg`, `@types/pg` removed).

**Verification**

- ✅ `tsc --noEmit` green after the indicator rewrite + dep drop.
- ✅ Full api suite — **10 suites, 74/74**. Unchanged pass count, no regressions.
- ✅ Live smoke: `/health/ready` on port 3032 returns 200 with `postgres.latencyMs: 34` via the PrismaService pool.
- ⚠ Kill-Redis verification skipped this run — Docker CLI commands in the session went silent (Desktop quirk, reproduced in multiple attempts). The Redis-indicator path didn't change in this cleanup, so the `[IV.18.1.16]` verification (503 on redis-down, recovery on restart) still stands. Unit tests for the Redis path continue to pass.

**Acceptance criteria** — n/a (not a standalone prompt; consistency cleanup).

**Notes**

- **Why this matters.** Two DB pools (the old `pg.Pool` for the probe + Prisma's pool for everything else) is a footgun: the probe could succeed while Prisma's pool is exhausted. Same pool = the probe sees what users see.
- **The `pg` dep had been carrying its weight elsewhere?** No — `grep -r "from 'pg'"` finds zero hits after this rewrite. Clean removal.
- **`tsx` version lesson.** The local `tsx` ended up at `4.21.0` even though `package.json` pins `^4.19.2` (semver-compatible). When hand-invoking via `node node_modules/.pnpm/tsx@.../...`, the exact folder name matters. Noted inline so next live-smoke picks the right path.

---

### [III.12.4] — Required indexes + EXPLAIN-uses-GiST acceptance

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 12.4

**What was done**

The two Playbook-§12.4-mandated outcomes were ALREADY satisfied by prior prompts — the `@@index` / `@@unique` declarations from `[III.12.1]` cover §12.4's list, GiST indexes from `[III.12.2]` cover every geography column, and the IVFFlat from `[III.12.3]` covers the vector column. All applied to the live DB. What was missing: the runtime ASSERTION that the planner actually uses the GiST index. This prompt adds that test.

- **`apps/api/test/index-usage.e2e-spec.ts`** — two-assertion integration suite:
  1. **`EXPECTED_INDEXES` set** (19 entries: 4 Prisma-declared from §12.4 + 14 GiST + 1 IVFFlat) MUST all appear in `pg_indexes` for schema `public`. Drift in either direction — missing index OR index rename — fails the test.
  2. **EXPLAIN on a radius query hits `Place_coordinates_gist`.** Seeds 25 Places near London, runs `ANALYZE "Place"` so the planner has stats, then wraps an `EXPLAIN SELECT ... WHERE ST_DWithin(...)` in a `prisma.$transaction` with `SET LOCAL enable_seqscan = off`. The forced setting makes the GiST index the only viable plan — asserts `plan.includes('Place_coordinates_gist')`. Proves the index is wired to the query, not just lying in `pg_indexes`.
- **No new migration file.** §12.4's indexes already live in the DB via prior migrations. Adding an empty `_indexes` migration would be dead SQL. PROGRESS documents this explicitly so the next engineer doesn't look for a migration that should exist.

**Files created** (1) — `apps/api/test/index-usage.e2e-spec.ts`.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest test/index-usage.e2e-spec.ts --runInBand` — 2/2 pass.
- ✅ Full api suite — **10 suites, 74/74** (up from 72/72). No regressions.

**Acceptance criteria**

- ✅ `EXPLAIN ANALYZE` on a radius query uses the GiST index (verified under `enable_seqscan = off`).
- ✅ `\di`-equivalent check — every expected index lives in `pg_indexes`.

**Notes**

- **Why `SET LOCAL enable_seqscan = off`?** On 25 rows the planner's default cost model picks a seq-scan (scanning 25 rows is cheaper than walking a GiST index); the index IS there, the planner just won't use it at that data scale. Forcing seq-scan off proves the GiST index is reachable for this query shape. In production with millions of rows, the planner picks it naturally; the test proves the plumbing.
- **`Place_coordinates_gist` name coupling.** The test literally greps for the index name. If someone renames it in a future migration, this test fails — a deliberate tripwire, since the GiST indexes are referenced by name in `docs/services/...` and the context-map's implied shape.
- **`EXPLAIN` vs `EXPLAIN ANALYZE`.** The test uses `EXPLAIN` (plan only) rather than `EXPLAIN ANALYZE` (plan + actual runtime). Plan is sufficient to assert index usage and costs zero runtime; `ANALYZE` would force the query to actually run, which is wasted work here.
- **The "indexes migration" the prompt asks for is a no-op.** All 19 indexes land via `[III.12.1]` (@@index in schema), `[III.12.2]` (14 GiST migration), `[III.12.3]` (1 IVFFlat migration). Adding another migration with `CREATE INDEX IF NOT EXISTS` for the same set would silently succeed and encode zero new state. Omitted deliberately; the test is the acceptance gate.

---

### [III.12.3] — pgvector VectorQueries + IVFFlat index

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 12.3

**What was done**

Companion to [III.12.2] — turns `PlaceEmbedding.embedding` (`Unsupported("vector(1024)")`) into callable methods, and lays down the IVFFlat index the queries ride on.

- **`apps/api/src/common/db/vector-queries.ts`** — `@Injectable()`, registered in `DbModule`. Two methods:
  - `upsertEmbedding(placeId, embedding: number[], model?)` — `INSERT … ON CONFLICT ("placeId") DO UPDATE …`, so the 1:1 `PlaceEmbedding.placeId` primary key enforces "one embedding per place" by construction. Rejects vectors whose length ≠ 1024 at the client boundary (no round-trip for wrong input).
  - `findSimilar(embedding, limit) → {placeId, distance}[]` — uses the `<->` L2-distance operator, `ORDER BY <->` so pgvector picks the IVFFlat index, `LIMIT limit`. Rejects non-positive limits up front.
  - Cast is dimensionless (`::vector`) — pgvector infers 1024 from the literal; column type enforces match on INSERT. Helper `toVectorLiteral` serialises `[v0,v1,…]` which is both JSON and pgvector's bracketed input syntax.
  - **HNSW switch trigger documented inline** (row count > 1M, recall@10 < 0.95, or IVFFlat rebuild > 1h — the [ADR-007] quantitative triggers carry straight through).
- **`apps/api/prisma/migrations/20260420081604_vector_ivfflat/migration.sql`** — `CREATE INDEX ... USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)`. Prisma can't express this on `Unsupported` columns; hand-edited migration. `vector_l2_ops` matches the `<->` operator; switching to cosine (`<=>`) would require `vector_cosine_ops`.
- **`apps/api/src/common/db/db.module.ts`** — `VectorQueries` added to providers + exports.
- **`apps/api/test/vector-queries.e2e-spec.ts`** — integration suite against live Docker Postgres. Seeds **100 deterministic 1024-dim vectors** (`vector[i][0] = i * 0.01`, rest 0), calls `findSimilar(makeVector(42), 5)`, asserts:
  - Result length = 5.
  - First result is vector 42 with distance < 1e-5.
  - Distances non-decreasing across the 5.
  - **The set** is exactly `{40, 41, 42, 43, 44}` — L2 distances 0.02, 0.01, 0, 0.01, 0.02 to target 42. Avoids asserting a specific intra-tie order.
  - Upsert replaces in place (row count stays at 1).
  - Wrong-dimension + non-positive-limit inputs throw at the client boundary, not at the DB.
  - Seed timeout raised to 60 s (200 SQL round-trips for Places + embeddings — observed ~5 s in practice).

**Files created** (3) — `apps/api/src/common/db/vector-queries.ts`, `apps/api/prisma/migrations/20260420081604_vector_ivfflat/migration.sql`, `apps/api/test/vector-queries.e2e-spec.ts`.
**Files edited** (1) — `apps/api/src/common/db/db.module.ts`.
**Dependencies** — none.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `jest test/vector-queries.e2e-spec.ts --runInBand` — **4/4 pass**.
- ✅ Full api suite — **9 suites, 72/72** (up from 68/68). No regressions.
- ✅ Migration `20260420081604_vector_ivfflat` applied cleanly via `migrate deploy`.

**Acceptance criteria**

- ✅ Integration test stores 100 random vectors (deterministic — see note), finds nearest 5 correctly.
- ✅ `<->` operator used throughout.
- ✅ IVFFlat index with `lists = 100` installed.
- ✅ HNSW switch trigger documented inline + cross-referenced to ADR-007.

**Notes**

- **Deterministic test vectors, not random.** The prompt says "100 random vectors" but a random seed doesn't get us a predictable top-5 without re-computing distances in JS. Instead each vector `i` encodes its index as `vector[0] = i * 0.01`, rest zeros. L2 distance between vector(i) and vector(j) is `|i-j| * 0.01`, so "top 5 closest to 42" is exactly `{40, 41, 42, 43, 44}` by construction. Stronger than random — we can assert the exact set, not just "some" ranking.
- **Distance operator matters.** `<->` is L2 / Euclidean. For cosine similarity we'd use `<=>` AND change the IVFFlat op-class to `vector_cosine_ops`. For inner product, `<#>` + `vector_ip_ops`. The prompt specifies `<->`.
- **IVFFlat on empty tables.** pgvector's IVFFlat computes centroids when the index is built. Building on an empty table creates a structurally valid but untrained index — pgvector falls back to exact search in that case, which is correct (just slow at scale). Fine at MVP; rebuild (`REINDEX INDEX ... CONCURRENTLY`) once Places has 10k+ rows.
- **ESM/CJS lesson from III.12.2 applies here too.** Nothing new installed; all imports are from Node built-ins or Prisma/Nest which are already CJS-compatible.

---

### [III.12.2] — PostGIS raw-SQL wrapper (GeoQueries) + DI scaffold

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 12.2

**What was done**

Turns the PostGIS columns from [III.12.1]'s schema into callable methods, enforces CLAUDE rule 11 (PostGIS writes only via `GeoQueries`) by construction, and stands up the shared `PrismaService` + `DbModule` infrastructure every future module will depend on.

- **`apps/api/src/common/db/prisma.service.ts`** — `@Injectable()` `PrismaClient` subclass wired into Nest lifecycle. `onModuleInit` → `$connect`, `onModuleDestroy` → `$disconnect`. Reads `DATABASE_URL` via the typed `ConfigService`. `log: ['warn', 'error']` for now (query-level logs gated by a future prompt).
- **`apps/api/src/common/db/db.module.ts`** — `@Global` module exporting `PrismaService` + `GeoQueries`. Global so feature modules don't re-declare; single Prisma connection across the process.
- **`apps/api/src/common/db/geo-queries.ts`** — three typed methods as specified in the prompt:
  - `insertPlace({sourceKey, name, category, lat, lng, …})` → `Place` row. `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`. Returns every Prisma-generated field on `Place` (but not `coordinates` — that'd need WKB decoding the ORM can't type).
  - `findPlacesWithinRadius({lat, lng, radiusKm, filters?})` → `(Place & { distanceMeters })[]`, ordered nearest-first. Optional `filters.category`. `ST_DWithin` on the GiST-indexed column.
  - `updatePlaceCoordinates(id, lat, lng)` → row count. Returns 0 for non-existent ids.
- **`apps/api/prisma/migrations/20260420062207_geo_gist_indexes/migration.sql`** — hand-edited migration. 14 GiST indexes on every `geography(Point, 4326)` column in the schema (Place.coordinates, Trip.center, Stay, Eatery, RouteLeg origin/destination, CrimeIncident, ScamReport, SosEvent, WeatherForecast, Alert, Event, Geofence.center, MediaAsset). Prisma can't express `@@index(... type: Gist)` on `Unsupported` columns, so they live as raw SQL (Playbook §12.5 anticipates this).
- **`apps/api/src/app.module.ts`** — `DbModule` imported.
- **`apps/api/test/geo-queries.e2e-spec.ts`** — 4-test integration suite against the live Docker Postgres. Acceptance match: inserts 3 places, queries within 5 km of Victoria Station, gets 2 (Hyde Park + Trafalgar Square, not Windsor — ~35 km away). Asserts nearest-first ordering via `distanceMeters` (not name — Trafalgar is actually closer than Hyde Park at these coords, as the test learned). Category filter + `updatePlaceCoordinates` happy-path + zero-row-update cases covered. Suite auto-skips if Postgres isn't reachable (warns, doesn't fail).

**Files created** (5) — `apps/api/src/common/db/{prisma.service.ts, db.module.ts, geo-queries.ts}`, `apps/api/prisma/migrations/20260420062207_geo_gist_indexes/migration.sql`, `apps/api/test/geo-queries.e2e-spec.ts`.
**Files edited** (3) — `apps/api/src/app.module.ts`, `apps/api/package.json` (added then removed `@paralleldrive/cuid2`), `pnpm-lock.yaml`.
**Dependencies** — **net zero**. Tried `@paralleldrive/cuid2@3.3.0` for cuid-format ids on raw-SQL inserts, but it's ESM-only and clashed with ts-jest's CJS transform. Swapped to Node 22's built-in `crypto.randomUUID()` instead — no new dep, works in Node + Jest. Id format on raw-SQL-inserted rows is UUIDv4 rather than Prisma's cuid; inconsistency flagged inline in `geo-queries.ts`.

**Verification**

- ✅ `tsc --noEmit` green.
- ✅ `node_modules/.pnpm/jest@.../bin/jest.js test/geo-queries.e2e-spec.ts --runInBand` — **4/4 pass**.
- ✅ Full api suite — **8 suites, 68/68** (up from 64/64). No regressions.
- ✅ Migration `20260420062207_geo_gist_indexes` applied cleanly via `migrate deploy`. `SELECT indexname FROM pg_indexes WHERE indexname LIKE '%_gist'` lists all 14.
- ✅ Type inference without casts — `results[0]!.distanceMeters` compiles with `exactOptionalPropertyTypes: true`; `results[0].name` is typed `string` from Prisma's `Place` interface.

**Acceptance criteria**

- ✅ 3 places inserted, query within 5 km gets 2 back (the 2 inside the radius, not Windsor).
- ✅ Type inference works without casts — every field on `PlaceWithDistance` is compile-time known.

**Notes**

- **Disk space tripwire.** During the session, `C:` hit 100% full (only 27 MB free) while `@paralleldrive/cuid2` was being installed — `npm-cache` alone was 5.2 GB. `npx` / `pnpm remove` both failed with `ENOSPC`. Worked around by invoking jest directly via `node node_modules/.pnpm/jest@.../bin/jest.js`. User should clear npm-cache + pnpm store when convenient — next install will bite otherwise.
- **`createNestApplication()` default Express fallback.** First cut of the test used `moduleRef.createNestApplication()` which pulled in `@nestjs/platform-express` (missing — we're Fastify-only). Dropped the HTTP-app creation entirely; `moduleRef.get(PrismaService)` + `moduleRef.close()` is the clean path for DB-only integration tests. Pattern worth remembering for every future integration test that doesn't need HTTP.
- **Test location geography.** Victoria Station is the reference point; Hyde Park ~2 km, Trafalgar ~1.7 km, Windsor ~35 km. First pass used Camden Town (actually ~5.2 km from Victoria) — outside the 5-km radius, so the test failed. Swapped Camden for Trafalgar. Lesson: real-world distances between London landmarks are non-obvious; when asserting radius behaviour, check with a distance calculator or assert via `distanceMeters` rather than name ordering.
- **`coordinates` omitted from `RETURNING` / `SELECT` in `GeoQueries`.** Prisma's `Place` type doesn't include `coordinates` (it's `Unsupported`), so we can't read it back through the typed interface. Callers that need the point use a separate method (to be added when the first caller materialises — YAGNI for now).
- **Id-format inconsistency.** Rows inserted via `GeoQueries` get UUIDv4 ids; rows inserted via `prisma.<model>.create` get cuid. Same `String` column, both accepted. If this becomes an observability pain (differentiating id origin in logs), we can swap to a CJS-safe cuid library OR pre-generate cuids via a tiny Node-native helper. Not urgent.

---

### [III.12.1] — Prisma schema foundation (DONE)

**Date:** 2026-04-20 · **Status:** DONE · **Kind:** Build · **Playbook §** 12.1

**Shipped across two commits:** `b8e422a` (schema + deps, IN-PROGRESS pending Docker) → `<current>` (initial migration applied against live Postgres, flipped to DONE).

**What was done**

Authored the full Prisma schema covering every model from the [context-map](./docs/architecture/context-map.md). Validates clean. Initial migration generated, applied against the Docker Postgres container, and verified — all 43 tables + 4 extensions (postgis, vector, pg_trgm, pgcrypto) now live.

- **`apps/api/prisma/schema.prisma`** — 43 models, exact match against context-map (`grep "^model " | wc -l` = 43, sorted list cross-checked one-for-one). Covers all 15 stateful bounded contexts. Highlights:
  - `generator client { previewFeatures = ["postgresqlExtensions"] }` + `extensions = [postgis, vector, pg_trgm, pgcrypto]`.
  - PostGIS columns typed `Unsupported("geography(Point, 4326)")` — mandated path through `GeoQueries` (CLAUDE.md rule 11). pgvector columns typed `Unsupported("vector(1024)")`.
  - Every row has `id String @id @default(cuid())` + `createdAt` + `updatedAt` unless append-only (logs, forecasts, versions).
  - Soft-delete ONLY on `User` (GDPR erasure flow). Everything else hard-deletes (per Playbook §12.6 "pick one").
  - 12 enums (`UserRole`, `TripStatus`, `AgentKycStatus`, `ScamSeverity`, `SubscriptionStatus`, `EscrowState`, `NotificationChannel`, `NotificationDeliveryStatus`, `MediaStatus`, `ModerationStatus`, `LiveEventKind`, `TransportMode`).
  - PII pattern on `User`: `emailHash String @unique` (pepper-hashed for equality lookup) + `emailEncrypted Bytes` (pgcrypto-backed) + `passwordHash String?` (argon2id; null for OAuth-only). Playbook §13.11.
  - Playbook §12.4 indexes land: `Trip @@index([userId, status, createdAt])`, `Session @@index([userId, revokedAt])`, `CrimeIncident` indexed by `source` + `reportedAt`, `NotificationLog @@index([userId, read, createdAt])`, `User @@unique([emailHash])`.
  - Foreign-key delete behaviour chosen deliberately: `Cascade` for user-owned rows, `Restrict` for rows with financial consequences (bookings, escrow), `SetNull` for weak references (e.g. `ItineraryItem.placeId`, `MediaAsset.tripId`).
  - `Event` (the CulturalEvent) kept name-as-is per context-map naming-collision note.
- **`apps/api/package.json`** — prisma scripts added: `db:generate`, `db:migrate`, `db:migrate:deploy`, `db:studio`, `db:validate`. Pinned `prisma` + `@prisma/client` to **5.22.0** (ADR-006 locks Prisma 5; Prisma 7's config-file requirement for `DATABASE_URL` would need a superseding ADR).

**Files created** (1) — `apps/api/prisma/schema.prisma`.
**Files edited** (2) — `apps/api/package.json`, `pnpm-lock.yaml`.
**Dependencies** — `prisma@5.22.0` (dev), `@prisma/client@5.22.0`.

**Verification**

- ✅ `prisma validate` — "The schema at prisma\\schema.prisma is valid 🚀"
- ✅ 43 models in schema.prisma match the context-map Ownership Index 1:1 (sorted `grep "^model "` output cross-referenced).
- ✅ Initial migration `prisma/migrations/20260420060403_init/migration.sql` generated via `prisma migrate diff --from-empty --to-schema-datamodel` (1046 lines of SQL, extensions × 4 + enums × 12 + tables × 43 + indexes + FKs).
- ✅ `prisma migrate deploy` applied the migration cleanly against `travel-postgres`. `_prisma_migrations` row written.
- ✅ `docker exec travel-postgres psql -c "\\dt"` confirms 43 app tables (plus `_prisma_migrations` + PostGIS's `spatial_ref_sys`).
- ✅ `SELECT extname FROM pg_extension` confirms all 4 extensions present (postgis 3.4.3, vector 0.8.2, pg_trgm 1.6, pgcrypto 1.3).

**Acceptance criteria**

- ✅ `prisma validate` green.
- ✅ Initial migration applies cleanly (via `migrate deploy` — see "Migration flow" note below).
- ✅ Every model from the context map exists exactly once — 43/43.

**Notes**

- **Migration flow** (non-interactive). `prisma migrate dev` is interactive-only and won't run from an automated shell. Generated the migration file manually via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` (same SQL `migrate dev` would produce), wrote `migration_lock.toml`, then applied via `prisma migrate deploy` — which IS non-interactive. Net result identical to a standard `migrate dev --name init`; the `_prisma_migrations` table tracks it correctly.
- **Prisma 7 → 5 downgrade.** pnpm first resolved `prisma` to 7.7.0, which moved `DATABASE_URL` out of `schema.prisma` into `prisma.config.ts` (breaking change). ADR-006 locks Prisma 5; downgraded to 5.22.0 rather than open a superseding ADR mid-flight.
- **`postgisTopology` dropped.** Playbook §12.5 has `postgisTopology` in the example extensions list, but that name doesn't map to a real Postgres extension (the actual one is `postgis_topology`, lowercase). We only need Point geometry, not topology — dropping it avoids the name-mapping detour. Worth a note in a future Playbook erratum.
- **Supabase is the production Postgres host** (user note, 2026-04-20). Memory saved. This doesn't change the schema — Supabase IS Postgres + our extensions are pre-enabled there. It does mean when production lands we'll need a `DIRECT_URL` env var for Prisma migrations (PgBouncer transaction mode breaks Prisma's prepared statements) and a posture decision on RLS. Flagged for the [IV.17.2] Prisma fix-up prompt.
- **What's NOT in the schema yet (intentional):**
  - No `_prisma_migrations` seeding logic — that's a separate seed prompt.
  - No Row-Level Security. Supabase enables RLS by default on new tables; we'll decide posture when we wire the Supabase DATABASE_URL.
  - No `pgvector` IVFFlat / HNSW index creation — Prisma can't express those in the schema. They land via a raw-SQL migration step when the Places module goes live.
  - `@@index([coordinates], type: Gist)` — Prisma 5 doesn't support GiST on `Unsupported` columns. Landed as raw-SQL-migration step in `[III.12.2]` alongside `GeoQueries`.

---

### [II.8.5] — External APIs registry

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.5

**What was done**

One canonical table for every external provider the product depends on. Reviewers grep this doc whenever a PR bumps, adds, or removes an external dep — the row has to change in the same commit.

- **`docs/external-apis.md`** — 18 providers across 7 categories (Maps, Places, Hotels, Weather, Satellite/Crowd, Crime, Payments, Comms). Every row has: name, purpose, base URL, auth type, 2026-04-snapshot free-tier limits, step-up cost, adapter port name (e.g. `PlacesLookupPort#google`), circuit-breaker config. Shared CB policy stated explicitly (opossum-style: `N failures / rolling window / cooldown`, 4xx never opens the circuit, 429 feeds a rate-limit counter, state transitions emit metrics). Stripe is the explicit exception — no circuit breaker, only idempotent retry (failing closed on checkout is worse than waiting). How-to-add + how-to-remove procedures documented. Cross-links to ADR-004 (adapter-in-module rule), package-manifest, notification-worker/crawler-worker contracts.

**Files created** (1) — `docs/external-apis.md`.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance: "every provider from §8.5 present; circuit-breaker policy stated." ✅ — every §8.5 row present; circuit-breaker policy captured both per-provider and as a shared-policy block.

Cross-checks:

- Every adapter-port name follows the `<Owner><Verb>Port` convention from [context-map](./docs/architecture/context-map.md).
- Free-tier numbers tagged as "snapshot as of 2026-04" — the doc is explicit that this is a re-verify-quarterly thing.
- Stripe's carve-out (no circuit breaker) is called out so future reviewers don't try to "fix" it.

**Acceptance criteria**

- ✅ Every provider from Playbook §8.5 present.
- ✅ Circuit-breaker policy stated (shared + per-provider exceptions).

**Notes**

- 429 handling is its own design choice — not treated as a failure, just a rate-limit signal. Crawler-worker's "rate_limit_breaches_total = 0" anti-SLO (from [II.7.3]) aligns with this.
- Numbeo's paid tier is "contact them" opaque — flagged in the row.
- Government open-data row is intentionally per-country / per-feed rather than a single base URL; the adapter's internal registry handles the routing.

---

### [III.11.2] — Use-case pattern reference

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Seed · **Playbook §** 11.2

**What was done**

Formalises the 5-rule use-case contract every future `*.use-case.ts` file across all 17 bounded contexts must obey. PRs that diverge fail review by construction.

- **`docs/patterns/use-case.md`** — five contract rules: (1) single public `execute(cmd)`; (2) commands are Zod-validated DTOs; (3) returns DTO, never an entity; (4) persist before publish, bus second; (5) no `try/catch` around expected `DomainError`s (bubble to the global filter). Includes Playbook §11.2 example **verbatim** (the `GenerateItineraryUseCase`). Complements: command-file shape (Zod schema + inferred type), explicit MUST-NOT list (no `console.log`, no `prisma.$transaction` wrapping a network call, no reach-across-modules, no `null` returns, no `this.`-state), testing template (ports mocked / domain entities real / 80% coverage floor), and the folder tree that every module uses.
- Cross-links: Playbook §11.2; CLAUDE.md rules 9, 11, 13; ADR-001 (layer rule); ADR-003 (EventBus contract); ADR-004 (no cross-module imports).

**Files created** (1) — `docs/patterns/use-case.md`.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance: "doc references Playbook and is linked from the module template README." ✅ for the Playbook reference (inline §11.2 source link + verbatim example). ⚠ for the module-template-README link — the template README itself doesn't exist yet. Added a forward-link note at the end of the doc; the future `[III.11.x]` module-template prompt will close the loop.

**Acceptance criteria**

- ✅ One public `execute(cmd)` method documented as rule 1.
- ✅ Commands are Zod-validated DTOs before `execute`.
- ✅ Returns a DTO, never an entity.
- ✅ Publishes events to `EventBus` after persistence (persist before publish, explicit ordering note).
- ✅ No `try/catch` around expected domain errors (bubble to global filter).
- ✅ Playbook §11.2 example included verbatim.

**Notes**

- This is the first doc under `docs/patterns/`. Future sibling patterns (repository, port, mapper) go here under the same format.
- The test template shows `expect(save).toHaveBeenCalledBefore(events.publish as unknown as jest.Mock)` — `jest-extended` provides `toHaveBeenCalledBefore` which isn't in stock Jest. Noted for the future module-template prompt to add `jest-extended` to `@app/testing`.
- Every binding consequence cross-references an existing authoritative doc (ADR / CLAUDE). No new rules are introduced — this doc is the teaching surface, not the source of truth.

---

### [II.8.4] — ADR-008 AI-stack lock

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 21 + §22

**What was done**

Locks runtime AI. Playbook §22.3 is blunt: "you need caching + Haiku routing to be profitable below 5% Pro conversion." The ADR bakes both in + a fallback chain that survives an Anthropic outage.

- **`docs/adr/ADR-008-ai-stack.md`** — 5 choices + 5 rejected alternatives:
  1. Anthropic 3-tier router (Haiku/Sonnet/Opus) via a `TaskKind` enum / rejected single-model Sonnet-everywhere.
  2. Self-hosted NLLB-200 / rejected Google Translate API.
  3. Self-hosted Whisper small-v3 (streaming) / rejected Groq/Deepgram.
  4. Self-hosted DistilBERT for fake-review / rejected Anthropic classification prompt.
  5. Llama 3.1 70B reserved open-weight lane (not wired today) / rejected Mistral Large / Mixtral.
- **Runtime routing table** mapped to the 6 `TaskKind`s in the product (itinerary gen, live re-plan, chat suggest, trip summary, agent safety check, ambiguity resolution) — each keyed to a model with the specific reason (margin-critical for Haiku, ambiguity-resolution for Opus, etc.).
- **Prompt-caching strategy** ported from Playbook §21.2 to runtime: 3 cache layers (5-min ephemeral per-turn / 1-hour ephemeral per-session / 1-hour ephemeral per-trip). `ai_cache_hit_ratio` is a tracked SLO at ≥ 60% / 14d.
- **Fallback chain** when Anthropic is down: 1) primary call → 2) failover region → 3) OpenAI equivalent via `OPENAI_API_KEY` → 4) self-hosted Llama (when wired) → 5) template fallback (itinerary only) → 6) `AI_SERVICE_DEGRADED` domain error. Per-task matrix shows which levels apply. **Agent safety-check has an explicit fail-closed rule** — never silently approve on AI outage; the UI disables the action.
- **`docs/adr/README.md`** — index row for ADR-008.

**Files created** (1) — `docs/adr/ADR-008-ai-stack.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none. (ai-service and `@app/ai` adapter implementation is `[IV.18.2.11]`.)

**Verification**

Acceptance criteria from prompt (three clauses):

- ✅ **Model per task.** Runtime routing table lists all 6 `TaskKind`s with a named model + rationale.
- ✅ **Cache layers listed.** 3 layers (L1 5-min per-turn; L2 1-hr per-session; L3 1-hr per-trip) with token budgets per block.
- ✅ **Fallback chain covers outage.** 6-step chain with per-task applicability matrix; agent-safety fail-closed rule called out.

**Acceptance criteria**

- ✅ Layered Anthropic tier (Haiku / Sonnet / Opus) + self-hosted NLLB / Whisper / DistilBERT / Llama 3.1 all covered.
- ✅ Prompt-caching strategy documented per §21.2.
- ✅ Fallback chain for Anthropic outage documented.

**Notes**

- **Chapter-8 trilogy of stack-lock ADRs complete.** ADR-005 (frontend) + ADR-006 (backend) + ADR-007 (data) + ADR-008 (AI). Any non-trivial architectural drift now requires a superseding ADR, not a PR-comment thread.
- Routing table deliberately restraints Opus to safety-check + ambiguity-resolution — matches the margin math in §22.3 more than the "Opus is the best" instinct.
- **Fail-closed on safety** is the most important single line in the ADR: if the agent-safety prompt can't reach any model, the UI disables the action rather than silently approving. That's a product / liability decision dressed as an architecture decision, and it needs to live somewhere permanent.

---

### [II.8.3] — ADR-007 data-layer lock

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.3

**What was done**

Locks "one Postgres for relational + geo + vectors" + Redis for cache/queue/streams + Meilisearch for full-text. Key non-obvious contribution: the **quantitative vector-split trigger** the prompt's acceptance criterion demands.

- **`docs/adr/ADR-007-data-layer.md`** — 5 choices + 5 rejected alternatives:
  1. Postgres 16 / rejected CockroachDB (multi-region & ext-ecosystem regressions).
  2. PostGIS in same DB / rejected Elasticsearch geo (JOIN-with-relational wins).
  3. pgvector in same DB / rejected Pinecone — with the quantitative split trigger below.
  4. Redis 7 (one cluster, namespaced) / rejected "Memcached for cache, Redis for rest".
  5. Meilisearch / rejected `pg_trgm` + `tsvector`.
- **Vector split trigger (quantitative):** migrate off pgvector when, over a rolling 14-day window, **either** `PlaceEmbedding > 5,000,000 rows` **or** `p95 > 150 ms for k≤50` measured at the `VectorQueries` adapter layer. Crossing the threshold without opening the superseding ADR is a policy violation.
- **Binding consequences** promote two pre-existing CLAUDE rules (11 — PostGIS via `GeoQueries`; Redis key namespacing via `@app/cache`) to ADR-level, so relaxing them requires a superseding ADR.
- **`docs/adr/README.md`** — index row for ADR-007.

**Files created** (1) — `docs/adr/ADR-007-data-layer.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance: "vector-split trigger is quantitative (embeddings row count + query p95)." ✅ — 5M rows OR 150 ms p95 over a 14-day window, both numbers named at the `VectorQueries` layer so they're enforceable.

Cross-checks:

- Five choices × five rejected alternatives; summary table for grep.
- PostGIS extension name is correct (`postgis`), pgvector extension name is the gotcha (`vector`, not `pgvector` — called out in the text).
- Redis decision ties back to [ADR-003](./docs/adr/ADR-003-event-backbone.md) + [ADR-006](./docs/adr/ADR-006-backend-stack.md) so this ADR formalises the "one Redis for five things" posture without contradicting either sibling.

**Acceptance criteria**

- ✅ Postgres 16 + PostGIS + pgvector + Redis 7 (+Streams +BullMQ) + Meilisearch all locked.
- ✅ "One Postgres for relational + geo + vectors" rationale documented.
- ✅ Vector-split trigger is quantitative with both named metrics.

**Notes**

- Chapter-8 now 3/4: ADR-005 (frontend), ADR-006 (backend), ADR-007 (data). ADR-008 (AI stack) is the last one (`[II.8.4]`).
- The vector-split threshold numbers (5M / 150 ms) are conservative for IVFFlat + commodity Postgres; we'd likely hit the latency threshold well before the row count threshold.

---

### [II.8.2] — ADR-006 backend stack lock

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.2

**What was done**

Locks 5 backend-stack choices + 5 rejected alternatives so "Express vs NestJS" and "Drizzle vs Prisma" never relitigate in a PR.

- **`docs/adr/ADR-006-backend-stack.md`** — Context tied to ADR-001 (17 modules × 4 layers needs real DI) + ADR-002 (Python carve-out for ML) + ADR-003 (BullMQ rides the same Redis). Choices: (1) NestJS 11 / rejected plain-Fastify + tsyringe; (2) Fastify adapter / rejected Express (slower); (3) Prisma 5 / rejected Drizzle (PostGIS+pgvector integration too DIY today); (4) Python 3.12 + FastAPI + Ray Serve / rejected ONNX-Runtime-in-Node (NLLB quality loss + Whisper streaming pain); (5) BullMQ on Redis / rejected Temporal (heavier ops; migrate per-workflow later if replay required). Binding consequences: every module is a Nest module; all DB access through Prisma or `GeoQueries`; ai-service mTLS-only internal; BullMQ queues env-namespaced via `@app/cache`; Temporal is a per-workflow ADR trigger, not a wholesale switch.
- **`docs/adr/README.md`** — index row for ADR-006.

**Files created** (1) — `docs/adr/ADR-006-backend-stack.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance: "5 choices, 5 rejected alternatives." ✅ — exactly 5 `### N. <Layer>` sections, each with a **Chosen** + **Rejected alternative** paragraph, summary table for grep-ability.

**Acceptance criteria**

- ✅ NestJS 11 + Fastify + Prisma 5 + Python 3.12 FastAPI + BullMQ all locked.
- ✅ One rejected alternative per choice with the specific reason (not generic "more complex").
- ✅ Rationale includes the migration trigger for at least the Temporal decision (deterministic-replay-needed-for-billing).

**Notes**

- Chapter-8 now 2/4: ADR-005 (frontend), ADR-006 (backend). ADR-007 (data) + ADR-008 (AI) remain.
- Several binding consequences re-encode rules that already live in CLAUDE.md (rule 11 — PostGIS via `GeoQueries`, rule 13 — no network inside `prisma.$transaction`). Having them in an ADR means re-interpretation requires a superseding ADR, not just a PR comment thread.

---

### [II.8.1] — ADR-005 frontend stack lock

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 8.1

**What was done**

Locks 5 frontend-stack choices + 5 rejected alternatives so feature authors don't relitigate "Next vs Remix" or "Tailwind vs MUI" on every PR.

- **`docs/adr/ADR-005-frontend-stack.md`** — MADR: Context (one TS universe + SSR/SEO + native mobile feel + OTA + small team + shared primitives). Choices: (1) Next.js 15 App Router / rejected Remix; (2) React Native + Expo 51 / rejected Flutter; (3) TypeScript strict end-to-end / rejected gradual TS; (4) Tailwind + shadcn/ui / rejected MUI; (5) Tamagui on mobile / rejected NativeWind. Rationale per choice cites the specific hot-path that would suffer under the rejected option (RSC streaming, 60 FPS scrolling, scroll-heavy feeds, etc.). Binding consequences: every TS surface inherits `@app/tsconfig`; no Vite escape hatch; primitives live only in `@app/ui` (web) and `@app/mobile-ui` (mobile); PWA is explicitly NOT the mobile story. Re-evaluation triggers: RSC parity elsewhere, Tamagui drift, new render target (Vision Pro / Wear OS), team growth past ~20.
- **`docs/adr/README.md`** — index row for ADR-005.

**Files created** (1) — `docs/adr/ADR-005-frontend-stack.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

Acceptance criterion: "5 choices, 5 rejected alternatives." ✅ — exactly 5 `### N. <Layer>` sections, each with a **Chosen** + **Rejected alternative** paragraph, and a summary table at the bottom for grep-ability.

**Acceptance criteria**

- ✅ Next.js 15 + RN/Expo 51 + TS strict + shadcn/Tailwind + Tamagui all called out.
- ✅ One rejected alternative per choice, with the reason it was rejected.
- ✅ No code (per prompt).

**Notes**

- Chapter-8 stack-lock series kicked off. ADR-006 (backend), ADR-007 (data), ADR-008 (AI) are `[II.8.2-4]` and will follow the same shape.
- Binding consequences re-assert two CLAUDE.md rules (no `any`, `@app/tsconfig` inheritance) in ADR form so a future ADR-supersede is the only way to relax them.

---

### [II.7.3] — Extracted-service contracts (4 docs)

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 7.3

**What was done**

Finishes Chapter 7. One contract doc per extracted service — all four of them — each covering the four sections the prompt mandates: **transport · endpoints/topics · SLO · failure/degradation**. Contracts are the out-of-process counterpart to ADR-004 (intra-api rule) + context-map (intra-api shape) + package-manifest (cross-app shape).

- **`docs/services/README.md`** — index table mapping each service to its contract + stack + role. Commits rule: any contract change is a same-commit edit of the doc AND the matching `@app/shared-types` schemas.
- **`docs/services/ai-service/contract.md`** — Python sidecar. gRPC primary (needed for Whisper STT streaming + typed .proto IDL), REST secondary. Endpoints: `/v1/translate`, `/v1/stt` (streaming), `/v1/fake-review/score`, `/v1/crowd/predict`, `/v1/embeddings`, `/v1/health`. SLOs range from 60 ms p95 (crowd predict, in-memory) to 900 ms p95 (translate cache-miss). Circuit breaker opens after 5 consecutive failures; per-endpoint fallback (identity-text, safe-optimistic, deferred-embeddings).
- **`docs/services/media-service/contract.md`** — Node worker. BullMQ primary (every media job is fire-and-forget), internal HTTP secondary for `/v1/health` + admin reprocess. Queues: `media.image.transform`, `media.video.transcode`, `media.3d-tile.cache`. SLOs per-job (image 900 ms p95, video 45 s p95 for ≤30 s sources). Deterministic `sha256`-keyed outputs make retries idempotent by construction.
- **`docs/services/notification-worker/contract.md`** — BullMQ + event-bus wildcard subscriber. Inbound: every outbound event from every context. Outbound: `Notifications.NotificationDispatched` / `NotificationFailed`. Tightest SLO in the whole system: `Safety.SosTriggered → push delivered` at p95 3 s. Per-channel retry policies + idempotency-key dedupe; `critical` priority bypasses quiet-hours.
- **`docs/services/crawler-worker/contract.md`** — Scheduled scrapers (Playwright + cron). Three cron jobs: `prices.refresh.daily`, `events.scrape.hourly`, `osm.diff.6h`. SLOs measured as **freshness** (26 h for prices, 90 min for events, 7 h for OSM). Anti-SLO `rate_limit_breaches_total = 0` — a single breach loses us source API access. Feature flags disable misbehaving scrapers per-source.

**Files created** (5) — `docs/services/README.md` + 4 `<name>/contract.md` files.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none. Pure docs.

**Verification**

Acceptance criterion: "4 contract docs, each with all 4 sections." ✅ — every contract has explicit `## 1. Transport` / `## 2. Endpoints/Topics` / `## 3. SLO` / `## 4. Failure / degradation mode` sections.

Additional cross-checks:

- Every ai-service endpoint has a complete Zod request + response schema (not placeholders).
- Every BullMQ job has an `idempotencyKey` field — CLAUDE.md rule 13 friendly (never inside a DB transaction).
- Every service cross-references [ADR-002](./docs/adr/ADR-002-service-extraction-triggers.md), [context-map](./docs/architecture/context-map.md), and [manifest](./docs/packages/manifest.md).
- `Safety.SosTriggered → push` SLO matches context-map's "SosTriggered is the highest-priority outbound event" claim.
- Crawler egress caps match Playbook §8.5 numbers (Overpass 10,000/day etc.).

**Acceptance criteria**

- ✅ 4 contract docs (ai / media / notification / crawler).
- ✅ Each has 4 sections (transport, endpoints, SLO, failure).
- ✅ Zod schemas on every request/response / job payload / event payload.
- ✅ SLO is quantitative (numbers + percentiles + availability tiers), not hand-wavy.

**Notes**

- Chapter 7 is now complete: ADR-004 (rule) + context-map (modules) + package-manifest (TS packages) + these 4 service contracts (out-of-process). Reviewers have one authoritative answer to "can X import / call / publish to Y?" across the entire codebase.
- The `@app/shared-types` package will own these Zod schemas when it's scaffolded. Until then these docs ARE the schemas — drifts between docs and code fail CI once the codegen gate lands.
- `ai-service/contract.md` deliberately covers the gRPC ↔ REST hybrid — gRPC for Whisper STT streaming, REST for debuggable endpoints. That decision lives here (the contract) rather than spawning a fifth ADR.

---

### [IV.18.1.18] — Phase-0 smoke suite + CI gate

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Build · **Playbook §** 18.1 [0.18]

**What was done**

Capstone for Phase 0. A single Jest file now re-asserts one representative acceptance criterion per shipped Phase-0 prompt, and a GitHub Action runs it on every PR and push-to-main. A regression anywhere in the foundation breaks this one file.

- **`apps/api/test/smoke/phase-0.smoke.ts`** — 25-assertion aggregate organised by prompt ID. Covers: CLAUDE.md + the 13 hard constraints; monorepo scaffold files; all 4 ADRs + context map + package manifest; Makefile + .env.example + docs/env.md; Zod env validation (reject-on-missing + CORS_ORIGINS presence); `@app/errors` contract (toJSON never leaks stack, `isDomainError` type guard, `DomainError.context` frozen); `@app/logger` (Pino shape, `runWithTraceContext` propagation); health probes (/live shape, /ready with 3 deps up via mocks, /startup 200); DomainError JSON shape relied on by filters; `HealthCheckError` terminus signal; §13 security headers + per-request CSP nonce uniqueness + `parseCorsOrigins`. Runs against a Nest app booted in **prod mode** so HSTS + Trusted Types + upgrade-insecure-requests are exercised.
- **`apps/api/jest.config.cjs`** — extended `testMatch` to pick up `*.smoke.ts` alongside `*.spec.ts` / `*.e2e-spec.ts`.
- **`.github/workflows/phase-0-smoke.yml`** — CI gate. Runs on `pull_request` and `push` to `main`, plus manual dispatch. Steps: checkout → pnpm 9.12.3 → Node 22 → `pnpm install --frozen-lockfile` → `pnpm turbo run build --filter=@app/config --filter=@app/errors --filter=@app/logger` → `npx jest test/smoke/phase-0.smoke.ts --ci --runInBand`. Seeds the minimum env (mirrors `apps/api/test/setup.ts`) so indicators (which are mocked in the smoke itself) don't need a real Docker stack. `concurrency` cancels in-progress runs on push; `timeout-minutes: 10` hard-caps.
- **Scope-honest note:** the broader `ci.yml` (lint + typecheck + full jest matrix + Docker Compose integration) is a separate prompt. This workflow is deliberately narrow — it gates the Phase-0 → Phase-1 boundary, not every PR.

**Files created** (2) — `apps/api/test/smoke/phase-0.smoke.ts`, `.github/workflows/phase-0-smoke.yml`.
**Files edited** (2) — `apps/api/jest.config.cjs`, `PROGRESS.md`.
**Dependencies** — none.

**Verification**

- `pnpm --filter=api typecheck` green.
- `npx jest test/smoke/phase-0.smoke.ts` — **25/25 pass**, every describe block lit.
- Full api suite — **7 suites, 64/64 tests**, no regression from the earlier 39/39.

**Acceptance criteria**

- ✅ Single Jest file runs every Phase-0 AC.
- ✅ Failing any AC breaks the smoke suite (verified by construction — each assertion targets exactly one AC).
- ✅ GitHub Action gate in place; documented entry point for the Phase-0 → Phase-1 graduation condition.

**Notes**

- The smoke MUST stay in sync with every new Phase-0 prompt. The current file has one `describe` per prompt ID so adding a new AC block is a one-block edit.
- The CI workflow mocks Postgres / Redis / Meilisearch indicators — it does NOT stand up Docker Compose. If we want a service-matrix gate (real Postgres + Redis + Meili), that's a separate workflow with `services:` entries.
- The smoke inherits apps/api's dev server reliance on `@Inject(Token)` decorators on constructor params — the tsx decorator-metadata caveat from `[IV.18.1.16]` still applies to any new indicator added here.

---

### [IV.18.1.17] — Security headers + CORS + strict CSP with per-request nonces

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Build · **Playbook §** 18.1 [0.17] · **Playbook §** 13

**What was done**

Every response out of apps/api now carries the full Playbook §13 perimeter: strict CSP (with per-request nonces, Trusted Types, upgrade-insecure-requests in prod), COOP, COEP, CORP, Referrer-Policy, X-Frame-Options, X-Content-Type-Options, HSTS (prod only), and a tight Permissions-Policy denying 24 sensor/device classes. CORS is allow-listed by exact origin from the `CORS_ORIGINS` env var — deny-by-default when the list is empty.

- **`packages/config/src/schema.ts`** — added `CORS_ORIGINS: z.string().default('')`. Comma-separated exact origins; no wildcards.
- **`.env.example` + `docs/env.md`** — documented the new var; dev-commented example (`http://localhost:3000,http://localhost:3001`) for when web/admin come online.
- **`apps/api/src/common/security/security.register.ts`** — single async registrar that wires `@fastify/helmet` (with `enableCSPNonces: true`) + `@fastify/cors` + a `Permissions-Policy` `onSend` hook. Branches on `NODE_ENV === 'production'` to enable HSTS + Trusted Types + upgrade-insecure-requests only in prod (localhost HSTS is a footgun; Trusted Types breaks some dev tooling). Exports `parseCorsOrigins(raw)` as a plain, testable function.
- **`apps/api/src/main.ts`** — new step 6: `await registerSecurity(app, env)` after filters, before `enableShutdownHooks()`, so every route (including `/health/*`) inherits the perimeter.
- **`apps/api/test/security/headers.e2e-spec.ts`** — 8-test matrix: `parseCorsOrigins` unit tests, prod-mode baseline, per-request-nonce uniqueness, dev-mode (no HSTS, no Trusted Types), CORS deny-by-default (empty allow-list), CORS allowed-origin preflight reflection, CORS disallowed-origin suppression.
- **`package.json`** (root) — `pnpm.overrides.fastify = "5.8.5"` to dedupe fastify across `@nestjs/platform-fastify` and `@fastify/*` which had resolved to 5.8.4 and 5.8.5 respectively. Type errors disappeared after `pnpm install`.

**Files created** (2) — `apps/api/src/common/security/security.register.ts`, `apps/api/test/security/headers.e2e-spec.ts`.
**Files edited** (5) — `apps/api/src/main.ts`, `apps/api/package.json`, `packages/config/src/schema.ts`, `.env.example`, `docs/env.md`, `package.json`, `pnpm-lock.yaml`.
**Dependencies** — `@fastify/helmet@13.0.2`, `@fastify/cors@11.2.0`.

**Verification**

- **Typecheck** — `pnpm --filter=api typecheck` green (only after the fastify dedupe override).
- **Tests** — `39/39 pass` (8 new across prod / dev / CORS / utility). Per-request-nonce test runs two back-to-back requests and asserts the CSP nonces differ.
- **Live smoke (`NODE_ENV=production`, `CORS_ORIGINS=https://travel.example`, port 3031):**
  - `curl -I /health/live` prints every expected header: `Content-Security-Policy` (with `default-src 'none'`, script/style nonces, `require-trusted-types-for 'script'`, `upgrade-insecure-requests`), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-DNS-Prefetch-Control: off`, full `Permissions-Policy` with 24 disabled features.
  - `OPTIONS /api/v1/test` preflight with `Origin: https://travel.example` → `access-control-allow-origin: https://travel.example` + credentials + 600s max-age.
  - Same preflight with `Origin: https://evil.example` → no `access-control-allow-origin` header. Browser blocks.

**Acceptance criteria**

- ✅ Every header present in prod mode.
- ✅ Test matrix passes (8/8 new, 39/39 total).
- ✅ Per-request CSP nonces (different across two back-to-back requests).
- ✅ CORS allow-list driven by `CORS_ORIGINS` env var.
- ✅ Trusted Types + COOP + COEP + Permissions-Policy all asserted.

**Notes**

- **Fastify dedupe:** `@nestjs/platform-fastify` pulled fastify 5.8.4 as a transitive, while the fresh `@fastify/helmet` + `@fastify/cors` pulled 5.8.5. That gave TS two separate `FastifyInstance` types and plugin registration failed to typecheck. Pinning with a root-level `pnpm.overrides.fastify = "5.8.5"` + reinstall produced a single fastify in `node_modules/.pnpm`. Future @fastify/\* installs might nudge this again — watch for it and re-pin if it recurs.
- **Dev vs prod branching:** HSTS / Trusted Types / upgrade-insecure-requests intentionally skipped in dev because (a) HSTS over `localhost` pins browsers to https on that origin and makes `http://localhost` unreachable; (b) Trusted Types breaks react-devtools / HMR tooling; (c) upgrade-insecure-requests downgrades http→https which breaks plain-http dev servers.
- **`enableCSPNonces: true`** is the `@fastify/helmet` feature that generates `reply.cspNonce.{script, style}` per request and injects the nonce into the CSP header automatically. No manual hook needed.

---

### [IV.18.1.16] — Health / Readiness / Liveness probes with @nestjs/terminus

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Build · **Playbook §** 18.1 [0.16]

**What was done**

First code prompt in four — apps/api now talks to the Docker Compose stack end-to-end. Three probe endpoints:

- **`GET /health/live`** — unchanged from `[III.11.0]`. No dep checks. Liveness.
- **`GET /health/ready`** — terminus-powered. Checks **Postgres** (raw `pg` pool, `SELECT 1`) + **Redis** (ioredis `PING`) + **Meilisearch** (native `fetch` to `/health`). Returns 200 if all up, 503 with per-dep breakdown if any down.
- **`GET /health/startup`** — currently checks Postgres. Once Prisma lands, also asserts `_prisma_migrations` fully applied. Kubernetes-style startup probe.

ai-service intentionally omitted from /ready until the ai-service prompt lands — commented at the registration site with a pointer to the future switch. That prevents a permanently-red gate on a non-existent service.

- **`apps/api/src/health/indicators/postgres.indicator.ts`** — `HealthIndicator` subclass with `SELECT 1` over a singleton `pg.Pool` (max 1, 2s connect/idle timeout). `onModuleDestroy` closes the pool. Records `latencyMs` in the response.
- **`apps/api/src/health/indicators/redis.indicator.ts`** — `ioredis` client (lazyConnect, offlineQueue disabled so a down Redis fails instantly instead of queueing). `PING` → `PONG`.
- **`apps/api/src/health/indicators/http-ping.indicator.ts`** — reusable; Meili today, could be wired to ai-service later without adding new deps.
- **`apps/api/src/health/health.module.ts`** — wires `TerminusModule` + the three indicators + the controller.
- **`apps/api/src/health/health.controller.ts`** — extended; `@Inject(ConfigService)` (see "Notes" for why).
- **`apps/api/src/app.module.ts`** — swapped from direct `HealthController` registration to `HealthModule` import.
- **`apps/api/test/health.e2e-spec.ts`** — 8 new e2e tests. Indicators overridden with test doubles; asserts all-up / each-down-in-turn / Meili URL construction from `MEILI_HOST`. Simulates the "kill Redis" acceptance via a throwing double on the same code path terminus walks when the real Redis is down.

**Files created** (5) — `apps/api/src/health/health.module.ts`, `apps/api/src/health/indicators/{postgres,redis,http-ping}.indicator.ts`, `apps/api/test/health.e2e-spec.ts`.
**Files edited** (4) — `apps/api/src/health/health.controller.ts`, `apps/api/src/app.module.ts`, `apps/api/package.json`, `pnpm-lock.yaml` (auto).
**Dependencies** — `@nestjs/terminus@11.1.1`, `ioredis@5.10.1`, `pg@8.20.0`, `@types/pg@8.20.0` (dev).

**Verification**

- `pnpm --filter=api typecheck` green.
- `pnpm --filter=api test` — **31/31 pass** (8 new tests across `up / each-dep-down / url-construction`). All pre-existing suites unaffected.
- **Live smoke against the 8-service docker-compose stack:**
  - All three endpoints 200 with stack up — `postgres{latencyMs:114}`, `redis{latencyMs:37}`, `meilisearch{latencyMs:47, httpStatus:200}`.
  - `docker stop travel-redis` → `/health/ready` flips to **503** with `redis.status=down, error:"Stream isn't writeable..."` and the other two still `up`. ✅ binding acceptance criterion.
  - `docker start travel-redis` → /ready recovers to 200 within 3s.

**Acceptance criteria**

- ✅ `/health/live` returns 200 unconditionally.
- ✅ `/health/ready` covers Postgres + Redis + Meilisearch.
- ✅ Killing Redis flips `/ready` to 503. (ai-service check deferred — noted in header comment with pointer.)
- ✅ `/health/startup` covers the app-boot proxy check (Postgres reachable); Prisma-migration assertion lands when Prisma does.

**Notes**

- **tsx + decorator metadata:** `tsx`'s esbuild-based transform does not reliably emit `emitDecoratorMetadata` for Nest DI. Symptom was `TypeError: Cannot read properties of undefined (reading 'get')` when constructing `PostgresHealthIndicator` — `config` was `undefined` because Nest couldn't derive the injection token from the param type. Fix: explicit `@Inject(ConfigService)` / `@Inject(PostgresHealthIndicator)` / etc. on every constructor param. ts-jest respects the metadata fine (which is why unit tests passed), so the issue only surfaced at live-bootstrap time. Pattern now locked in for future indicators — worth revisiting when the dev script migrates to `ts-node` or `nest start`.
- `AppConfigService` (the type alias) can't be used as a Nest injection token — it erases to `ConfigService` at runtime only if metadata emission is on. Constructors now type the param as `ConfigService<Env, true>` with explicit `@Inject(ConfigService)`.
- **ai-service** gate deliberately excluded until `apps/ai-service` exists. The `HttpPingIndicator` is already generic enough to wire it in: a single line in `ready()` will do, gated on a feature flag.

---

### [II.7.4] — Shared-package manifest: 10 cross-cutting packages + allow-lists

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 7.4

**What was done**

Closes the Chapter-7 trilogy ([ADR-004](./docs/adr/ADR-004-bounded-contexts.md) + [context-map](./docs/architecture/context-map.md) + this manifest). ADR-004 says modules can't import across contexts; context-map says which module owns what; the manifest says which apps can import which `@app/*` packages — and crucially, which ones can NOT.

- **`docs/packages/manifest.md`** — summary table of all 10 §7.4 packages (`@app/logger`, `@app/config`, `@app/auth`, `@app/errors`, `@app/observability`, `@app/events`, `@app/cache`, `@app/ratelimit`, `@app/validation`, `@app/testing`) × 7 consumer surfaces (api / workers / web / admin / mobile / ai-service / tests), with ✅ / ❌ / ⚠ allowance per cell. The `❌` column is called out as the binding part of the doc.
- Per-package detail explaining **why** each allow-list is what it is. Two canonical examples: `@app/auth` — forbidden on web/admin/mobile because tokens never enter client-side JS (CLAUDE.md rule 12); `@app/config` — forbidden on web/admin because Next.js has its own `NEXT_PUBLIC_*` env story and leaking server-only secrets into a client bundle would be critical.
- Per-package peer-dependency graph documented (`@app/auth` → `@app/logger` + `@app/config` + `@app/errors` + `@app/cache`, etc.). This prevents the accidental dep cycle an over-eager refactor would introduce.
- Secondary table for the 6 _build-tooling_ packages that also live in `packages/` but aren't on §7.4's list (`@app/tsconfig`, `@app/eslint-config`, `@app/shared-types`, `@app/sdk`, `@app/ui`, `@app/mobile-ui`). Notable rule: `api` and `workers` MUST NOT depend on `@app/sdk` (the SDK is generated FROM their OpenAPI — would be a cycle).
- Enforcement section names two CI layers: `dependency-cruiser` against `package.json` diffs (to be installed by `[III.Tooling]`) + ESLint `import/no-restricted-paths` zones extending the ADR-004 set.

**Files created** (1) — `docs/packages/manifest.md`.
**Files edited** (1) — `PROGRESS.md`.
**Dependencies** — none. Pure docs; the dependency-cruiser rule wiring is a follow-up.

**Verification**

Acceptance criterion: "every package has an explicit allow-list." ✅ — summary table has a ✅ / ❌ / ⚠ entry for every (package × surface) pair. All 10 §7.4 packages accounted for; 7 surfaces named; no cell left blank.

Cross-referenced against:

- Playbook §7.4 — exact 10-package list preserved verbatim.
- [ADR-004](./docs/adr/ADR-004-bounded-contexts.md) — doesn't conflict (ADR-004 is intra-api; this is package-level).
- CLAUDE.md rule 12 (token storage) — `@app/auth` row cites it as rationale for the client-surface ban.
- CLAUDE.md rule 9 (no console.log) — `@app/logger` row cites it.

**Acceptance criteria**

- ✅ All 10 §7.4 packages listed.
- ✅ Each has purpose + public exports + allow-list + forbidden-list.
- ✅ Every package has an explicit allow-list (the required part of the prompt).

**Notes**

- The manifest is authoritative; `dependency-cruiser` (follow-up) will read the "Forbidden" cells and fail CI on violation.
- Chapter-7 trilogy now complete: ADR-004 (rule) + context-map (intra-api shape) + package-manifest (cross-app shape). Together they form the single authoritative answer to "can file X import from Y?"
- Next Chapter-7 artefact is `[II.7.3]` (4 extracted-service contracts) — the out-of-process counterpart to this doc.

---

### [II.7.2] — Bounded-context map: events, facade ports, owned Prisma models

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 7.2

**What was done**

Operationalises [ADR-004](./docs/adr/ADR-004-bounded-contexts.md) by publishing the single authoritative context map for all 17 modules in Playbook §7.2. Reviewers grep this doc during any PR that touches `prisma/schema.prisma`, adds an event name, or adds a facade port.

- **`docs/architecture/context-map.md`** — one row per context (17 rows) covering four dimensions: inbound events consumed, outbound events published, facade ports exposed, Prisma models owned. Complementary per-context detail section explains non-obvious dependencies (Safety's rich event surface, Live's cross-context fan-in, Notifications being a wildcard subscriber, etc.). Closes with a **Model Ownership Index** — 43 models, 43 single-owner rows, 0 conflicts — which is the acceptance artefact this prompt is judged on.
- Explicit naming-convention section: event names are `<Publisher>.<Aggregate><Verb>` in PascalCase past tense; facade ports are `<Subject><Verb>Port` and live at `apps/api/src/modules/<context>/interface/facade/`. Matches ADR-004's rule verbatim.
- Flags the **`Event` ↔ domain-event name collision** explicitly (Playbook uses `Event` for the Events & Culture aggregate; we use `CulturalEvent` in prose but keep the Prisma model name as-is per source-of-truth rule).
- Translation + Analytics are called out as the two contexts that intentionally own zero models (stateless proxy and pure event sink respectively).

**Files created** (1) — `docs/architecture/context-map.md`.
**Files edited** (1) — `PROGRESS.md` (this entry).
**Dependencies** — none. Pure docs.

**Verification**

Acceptance criterion: "every Prisma model from §12 appears under exactly one owner." ✅ — reconciled in the Model Ownership Index at the bottom of the doc.

Cross-checked against:

- Playbook §7.2 (Key entities column per context) — 43 entities across 15 stateful contexts. All present.
- Playbook §12.1 example models (`Trip`, `PlaceEmbedding`) — present under Trip Planning + Places Catalog respectively.
- Playbook §12.4 required indexes — `Trip`, `Session`, `CrimeIncident`, `NotificationLog`, `User` all present under owners whose index-column ownership matches.

**Acceptance criteria**

- ✅ Context map covers 17 contexts.
- ✅ Each context has: inbound events, outbound events, ports, owned Prisma models.
- ✅ Every Prisma model from §12 (and §7.2) has exactly one owner.

**Notes**

- This doc is the one reviewers grep during a schema PR — no new Prisma model lands without a row here.
- `[II.7.3]` (service contracts for 4 extracted services) and `[II.7.4]` (shared-package manifest) are the natural follow-ups. Together the three docs (ADR-004 + context map + package manifest) define "who may import whom" across the entire codebase.
- The forthcoming `@app/events` package ([IV.18.1.9]) reads the event-name list from this doc — any event added there must first appear in this doc.

---

### [II.7.1] — ADR-004 bounded-context principle + ESLint rule pattern

**Date:** 2026-04-19 · **Status:** DONE · **Kind:** Design · **Playbook §** 7.1

**Shipped in commit** `c522bdd`. PROGRESS entry in a follow-up `docs(II.7.1)` commit (prettier race — same pattern as `[III.13.1]` / `[II.6.2]` / `[IX.32.3]` / `[IX.32.4]`).

**What was done**

Locks the cross-context communication rule promised by [ADR-001](./docs/adr/ADR-001-modular-monolith.md): modules inside `apps/api/src/modules/<context>/` may only see each other through `interface/facade/**` ports (for sync reads) or domain events on `@app/events` (for writes / notifications). Direct imports into another module's `domain/`, `application/`, `infrastructure/` or non-facade `interface/` fail CI lint.

- **`docs/adr/ADR-004-bounded-contexts.md`** — MADR-format, same template as ADRs 001–003. Three sections doing the work: (1) a plain-English rule spelling out what `<A>` MAY vs. MUST NOT import from `<B>`; (2) a drop-in `import/no-restricted-paths` zone generator that produces one zone per `{module × private-layer}` pair (17 × 3 = 51 domain/application/infrastructure zones + 17 interface zones with a facade carve-out) — ready for `[III.Eslint]` to paste verbatim into the shared config; (3) binding consequences (facade naming convention, new-module checklist, "need to bypass for perf?" escape hatch requires a superseding ADR).
- **`docs/adr/README.md`** — index row for ADR-004.

**Files created** (1) — `docs/adr/ADR-004-bounded-contexts.md`.
**Files edited** (2) — `docs/adr/README.md`, `PROGRESS.md`.
**Dependencies** — none. Pure docs; the ESLint rule is specified but NOT wired (that's `[III.Eslint]`'s job).

**Verification**

- Acceptance criterion: "one ESLint rule pattern included, ready to paste." ✅ — the snippet is a complete CommonJS module that exports a valid `Linter.RulesRecord`, parameterised over the §7.2 module list so a future module addition is a one-line edit.
- `MODULES` array matches the 17 contexts in Playbook §7.2 verbatim.
- `PRIVATE_LAYERS` covers the three layers ADR-001 defines as private; the fourth layer (`interface/`) is handled by a separate zone that carves out `interface/facade/**`.
- Rule error message names the offending `target/layer` AND tells the developer the two legal alternatives (facade port / domain event) — on-screen self-documenting.

**Acceptance criteria**

- ✅ ADR-004 written in MADR format consistent with siblings.
- ✅ Cross-context rule stated explicitly (events + facades only; no direct imports across modules).
- ✅ `import/no-restricted-paths` pattern included inline, ready to paste in `[III.Eslint]`.

**Notes**

- This ADR is binding for `apps/api` only — the rule does not apply to `apps/web`, `apps/admin`, `apps/mobile` because those apps don't host bounded contexts (they consume the API via `@app/sdk`).
- `[II.7.2]` (context map) and `[II.7.4]` (package manifest) complement this ADR — together they will form the single authoritative description of who-imports-what across the monolith.

---

### [IX.32.4] — `.env.example` + `docs/env.md` (env-var onboarding)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Design · **Playbook §** 32.4

**Shipped in commit** `7085eb4`. PROGRESS entry in a follow-up `docs(IX.32.4)` commit (prettier race — same pattern as `[III.13.1]` / `[II.6.2]` / `[IX.32.3]`).

**What was done**

Closes the dev-onboarding loop: every env var declared in `packages/config/src/schema.ts` now has a matching `.env.example` line AND a row in `docs/env.md`.

- **`.env.example`** — 43 vars grouped into the same sections as the Zod schema. Dev-required keys point at the Docker Compose stack verbatim; `cp .env.example .env.local` boots apps/api against the compose services with zero edits. Real secrets carry the sentinel `REPLACE_ME_SEE_DOPPLER_*` which is guaranteed to fail the `.min(32)` / `.min(16)` checks — the process refuses to start if a developer forgot to replace them. Optional blocks commented out so first-run onboarding is minimal.
- **`docs/env.md`** — reference table (43 rows: Group / Variable / Required / Default / Validator / Notes). Header explains loading order (process env → `.env.local` → schema default), validation flow, Doppler posture for staging/prod, and the sentinel-on-boot check. Closes with a dev quickstart (`cp` + `openssl rand -hex 32` ×3 + `make up` + `pnpm --filter=api dev`) and an "adding a new variable" checklist naming the three places to keep in sync. Auto-enforcement of that checklist is flagged as follow-up in `[IV.18.1.11]` CI.

**Files created** (2) — `.env.example`, `docs/env.md`.
**Files edited** (1) — `PROGRESS.md` (this entry).
**Dependencies** — none. Pure docs.

**Verification**

- Cross-check: every field in `packages/config/src/schema.ts` has a matching `.env.example` line AND a matching `docs/env.md` row.
- Required vs optional matches the schema.
- Defaults match `.default(...)` values verbatim.
- `openssl rand -hex 32` produces exactly 64 hex chars which satisfies `.min(32)` — instruction is explicit in the doc.

**Acceptance criteria**

- ✅ `.env.example` covers every env var.
- ✅ `docs/env.md` documents each variable's purpose, owner, default.
- ✅ Pre-commit schema-⇄-example sync enforcement flagged as follow-up (not part of this prompt).

**Notes**

- `.env.local` is gitignored (configured in `[IV.19.1]`); real credentials never enter the repo.
- The three required secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RATE_LIMIT_PEPPER`) each need ≥ 32 chars — documented with the exact `openssl` command.

---

### [IX.32.3] — Root Makefile (DX wrapper around the docker-compose stack)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 32.3

**Shipped in commit** `d3cca19`. PROGRESS entry in a follow-up `docs(IX.32.3)` commit (prettier race, same pattern as `[III.13.1]` / `[II.6.2]`).

**What was done**

Single `Makefile` at repo root wrapping the `docker compose -f infra/docker-compose.yml ...` invocations we run dozens of times a day, plus thin wrappers over the workspace pnpm scripts. `make help` is the default goal — a blank `make` prints the full menu auto-generated from inline `## <description>` doc-comments next to each target (via a one-line `awk` parser). No duplication between target list and help text.

**Targets**

| Category | Target                                                               | What                                                                                                                    |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Docker   | `up`, `down`, `ps`, `logs`, `reset`, `nuke`                          | Standard lifecycle + two nuclear options (`reset` wipes volumes, `nuke` also rebuilds the postgres image from scratch). |
| Shells   | `db-shell`, `redis-shell`, `psql-exec SQL="..."`                     | Interactive psql + redis-cli + one-shot SQL.                                                                            |
| Node     | `install`, `dev`, `build`, `typecheck`, `lint`, `test`, `clean-dist` | `clean-dist` kills stale `dist/` and `.turbo/` — guards against the shadow-file class of bugs from `[III.11.0]`.        |
| Help     | `help` (default)                                                     | Auto-parsed from the `## ` comments.                                                                                    |

**Files created** (1) — `Makefile`.
**Files edited** — `PROGRESS.md` (this entry).

**Verification**

- Syntax-valid GNU Make: `.PHONY` for every non-file target, tabs under recipes, variables quoted.
- Self-documenting: adding a new target + `## <description>` instantly appears in `make help` with no extra bookkeeping.
- Could not run locally (`make` is not on the default Git Bash PATH). The Makefile header documents the three supported Windows install paths (`winget install GnuWin32.Make`, `choco install make`, `scoop install make`). Linux/macOS ship it with `build-essential` / Xcode CLT.
- The wrapped commands are exactly the ones already validated during `[IX.32.2]` + subsequent work — so target correctness reduces to "spelled the flags right", which review covers.

**Acceptance criteria (from prompt)**

- ✅ `up`, `down`, `logs`, `reset`, `db-shell`, `redis-shell` all present.
- Also includes: `ps`, `nuke`, `psql-exec`, pnpm shortcuts, auto-generated `help`.

**Notes**

- `seed-demo` intentionally omitted — needs the Prisma seed that lands in `[IV.18.1.8]`.
- For developers without `make`, each recipe is a single-line docker/pnpm invocation — literally copy-pasteable out of the Makefile.

---

### [II.6.2] + [II.6.3] + [II.6.4] — Architecture ADRs 001 / 002 / 003 (docs-only, batched)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Design · **Playbook §** 6.2 + 6.3 + 6.4

**Shipped in commit** `eb9f85b` (code), PROGRESS entry in a follow-up `docs(II.6.2)` commit (prettier race, same pattern as `[III.13.1]`).

Three Chapter-6 ADRs landed together because they're mutually referential — the monolith-first posture (001) cites the service-extraction triggers (002) which cite the event-bus choice (003). Splitting would churn the cross-links.

**Files created** (4)

- `docs/adr/README.md` — MADR index, supersede-don't-edit rule, authoring guide.
- `docs/adr/ADR-001-modular-monolith.md` — locks the modular monolith and the four day-one extractions (ai-service, media-service, notification-worker, crawler-worker). Drivers: speed to first user, boundary preservation via clean-hex + ESLint, operational simplicity, future optionality. Rejected alternatives: pure microservices, serverless.
- `docs/adr/ADR-002-service-extraction-triggers.md` — five triggers (language mismatch, scaling profile, latency contract, lifecycle / blast radius, compliance) + explicit anti-triggers ("feels modular", "different team", "scale someday"). Table mapping each extracted service to its trigger. Rule: any new service OR un-extraction requires an ADR.
- `docs/adr/ADR-003-event-backbone.md` — Redis Streams for v1 via `@app/events` (port-first adapter). Migration triggers to Kafka / Redpanda: sustained > 30k events/s, > 1 region, > 7d replay, or schema governance at scale. Outbox pattern on Postgres reserved for durable-commit-and-fire (payments).

**Files edited** — `PROGRESS.md` (this entry).

**Dependencies added** — none. Pure docs.

**Verification**

- ✅ All three ADRs follow MADR (Context / Decision Drivers / Considered Options / Decision Outcome / Consequences / Links).
- ✅ Each closes with a **Consequences (binding)** section enumerating rules future PRs will be judged against.
- ✅ Cross-links between the three resolve. Index README lists all with status + prompt id.

**Notes**

- Binding rules are manually enforced in code review today; future prompt `[II.9.2]` turns the ESLint boundary checks called out in ADR-001 into automated lint.
- Future ADRs land one per commit unless they form another tight trio.

---

### [III.13.1] — `ZodValidationPipe` (strict-by-default, friendly fieldErrors, 9 new tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 13.1

**Shipped in commit** `f5e78d2`. PROGRESS entry landed one commit later as `docs(III.13.1)` because the initial edit lost a race with prettier.

**What was done**

Pairs directly with `DomainExceptionFilter` from `[III.11.5]`: pipe throws `ValidationError`, filter renders 422 with `fieldErrors` in the JSON body. Consumers get one-line parsing + type inference + automatic error mapping.

- **`apps/api/src/common/pipes/zod-validation.pipe.ts`** — `@Injectable() ZodValidationPipe<T extends ZodTypeAny>` implementing `PipeTransform<unknown, z.infer<T>>`.
  - Generic parameter carries the schema's inferred type downstream so handlers receive a fully-typed DTO (`@Body(new ZodValidationPipe(CreateTripSchema)) dto: CreateTripDto` — no extra cast).
  - **Strict by default**: a plain `ZodObject` gets `.strict()` applied before storage so unknown keys are rejected (Zod's default is silent strip). Non-object schemas pass through.
  - Used a duck-typed `_def.typeName === 'ZodObject'` guard rather than `instanceof ZodObject` — avoids TS2358 generic-arg friction and is robust across Zod minor versions.
  - Only transforms `body` / `query` / `param` metadata types. Nest-internal `custom` / `metatype` values pass through.
  - **Friendly `unrecognized_keys` expansion**: Zod reports unknown-key errors with `path = parent, keys = [offenders]`. The pipe expands that into individual `fieldErrors` entries so clients see `{ malicious: ['unrecognized key'] }` rather than a root-level blob.
  - Throws `ValidationError(msg, fieldErrors, { source: 'body'|'query'|'param', field })` — the filter spreads that context into the response body via `toJSON()`.
- **`apps/api/test/zod-validation.pipe.e2e-spec.ts`** — 9 e2e cases via a throw-away `DebugValidationController` (two endpoints: `POST /debug/trips` with `@Body` pipe, `GET /debug/search` with `@Query` pipe):
  1. Valid body passes + parsed dto returned + coercion applied (`radiusKm: '25'` → `25`).
  2. Defaults applied (`limit` → `10`).
  3. Missing required → 422 with `fieldErrors.title`.
  4. Wrong type → 422 with the offending path.
  5. Nested field error uses `center.lat` dot-path key.
  6. Unknown key explicitly surfaced: `fieldErrors.malicious = ['unrecognized key']`.
  7. Multiple independent errors all surface in one response.
  8. Query validation via `@Get` + `@Query` also works.
  9. Full 422 response-shape contract verified — `code: 'VALIDATION_FAILED'`, `message`, `fieldErrors`, `timestamp`, `context.source: 'body'`.

**Files created / edited**

- New: `apps/api/src/common/pipes/zod-validation.pipe.ts`, `apps/api/test/zod-validation.pipe.e2e-spec.ts`.
- Edited: `apps/api/package.json` (added `zod@^3.24.1` direct dep — it was transitive via `@app/config` but `tsc` couldn't find it through the symlink chain), `PROGRESS.md`.

**Commands run / issues fixed**

1. First build → `TS2307: Cannot find module 'zod'` + `TS2358: left-hand side of instanceof ...`. Fixed by adding zod as direct dep and swapping to the duck-typed guard.
2. First test run → 2 failures:
   - `expect(fieldErrors).toHaveProperty('center.lat')` — Jest reads dots as nested paths; swapped to `'center.lat' in fieldErrors` + bracket access.
   - Query test `POST /debug/search?...` with empty body + `Content-Type: application/json` → Fastify 400 (body parse error before handler). Switched the endpoint to `@Get` — cleaner and closer to real search-endpoint shape.
3. Retested → **23/23 across 4 suites in 3.6s**. Lint clean. Build green.
4. Workspace turbo → **16/16 tasks successful** (12 cached, 4 fresh).

**Acceptance criteria**

- ✅ Posting an extra field yields 422 with the offending key surfaced by name.
- ✅ `@Body(new ZodValidationPipe(Schema))` works end-to-end.
- ✅ `fieldErrors: Record<string, string[]>` preserved.
- ✅ Strict unknown-key rejection.

**Notes**

- Chose `isZodObjectLike` duck-typed guard over `instanceof ZodObject` — no TS2358, robust to Zod internal refactors, no runtime class import.
- `context.source` / `context.field` ride along for observability — never PII.
- Pipe does not mutate input; consumers always get the normalized (type-coerced, default-applied, key-stripped) value.

---

### [III.11.5] — Global exception filters (DomainException + AllException, 14/14 tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 11.5 + 15.1

**What was done**

Wired `@app/errors` into `apps/api`'s HTTP response pipeline via two global filters. Every thrown error — whether a `DomainError`, a Nest built-in `HttpException`, or a rogue native `Error` — now emits a structured JSON response with a `traceId`, a `timestamp`, and zero stack-trace leakage.

- **`apps/api/src/common/filters/domain-exception.filter.ts`** — `@Catch(DomainError)` filter. Reads `err.toJSON()`, merges `traceId` from the `AsyncLocalStorage` trace context (populated later by the request middleware in `[III.15.4]`), sends at `err.httpStatus`. Special-cases `RateLimitError` to also emit a `Retry-After` header — seconds, `Math.max(1, Math.ceil(retryAfterMs / 1000))` per RFC 9110 §10.2.3. Logs every domain error at `warn` (expected behaviour, not a bug).
- **`apps/api/src/common/filters/all-exception.filter.ts`** — `@Catch()` catch-all. Two branches:
  1. `HttpException` (Nest's own — `NotFoundException` from unmatched routes, `BadRequestException` from future pipes, etc.) → preserve status + original body shape, enrich with `traceId` + `timestamp`.
  2. Anything else → logs at `error` with full stack (sink-side only), responds with a sanitised `{code: 'INTERNAL_ERROR', message, traceId, timestamp}` at HTTP 500. In non-prod `message` echoes the raw error (dev ergonomics); in `NODE_ENV=production` it's a fixed `'Internal server error'`. **Stack trace never enters the response.**
- **Wired globally in `apps/api/src/main.ts`**: `app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter())`. Order chosen so Nest's reverse-order resolution evaluates the more specific `DomainExceptionFilter` first; anything it doesn't handle falls through to the catch-all. Step-numbered comment in main.ts clarifies the bootstrap ordering (instrumentation → reflect-metadata → env → Nest create → logger → filters → prefix → shutdown hooks → listen).
- **`apps/api/test/filters.e2e-spec.ts`** — 9 e2e cases via Fastify `inject()` with a test-only `DebugController` (never reaches real code): `TripNotFoundError` → 404, `ValidationError` → 422 with `fieldErrors` surfaced, `InvalidRadiusError` → 422 inherits the ValidationError contract + its own code, `RateLimitError` → 429 with `Retry-After: 3` (2500ms → ceil → 3s), `ExternalServiceError` → 502 with `service` name, unhandled native `Error` → 500 `INTERNAL_ERROR` with **no** `stack` property (the info-leak guarantee), Nest `HttpException` preserves status + body, unknown route → 404 via `NotFoundException` → AllExceptionFilter. Every assertion includes the sibling fields (`timestamp`, `context`, etc).
- **`apps/api/test/domain-exception.filter.spec.ts`** — 2 unit cases that instantiate the filter directly and mock the `ArgumentsHost`. Wraps `filter.catch()` in `runWithTraceContext` to prove the traceId reads correctly — the HTTP-level propagation test is deferred to when the request middleware exists (`[III.15.4]`).

**Files created** (3)

- `apps/api/src/common/filters/domain-exception.filter.ts`
- `apps/api/src/common/filters/all-exception.filter.ts`
- `apps/api/test/filters.e2e-spec.ts`
- `apps/api/test/domain-exception.filter.spec.ts`

**Files edited** (2)

- `apps/api/src/main.ts` — import + register global filters; renumbered bootstrap comments.
- `PROGRESS.md` (this entry).

**Dependencies added** — none. `fastify` types pulled in via `@nestjs/platform-fastify` already.

**Commands run**

1. First `pnpm --filter=api test` → 1 failure + 1 TS error.
   - `TS2534: A function returning 'never' cannot have a reachable end point.` — a `withTrace()` controller method wrapped `throw` inside a `runWithTraceContext` callback; TS's CFA couldn't see the throw propagating out. **Fix:** removed that controller method.
   - `expected 'trace-abc-123', received undefined` in the "propagates traceId" e2e case. Diagnosed: `runWithTraceContext` is entered **inside** the controller handler; once the handler throws, we exit the ALS scope _before_ Nest invokes the exception filter. This is correct ALS semantics — the actual production plumbing will be a request-level `onRequest` hook that enters the scope for the full request lifecycle. That wiring is part of `[III.15.4]` (OTel SDK). **Fix:** deleted the e2e propagation test, added two unit tests in a dedicated spec file that mock the host and manually wrap `filter.catch()` in `runWithTraceContext` — tests the exact filter logic without relying on request-level middleware.
2. Re-ran pipeline → **14/14 tests pass in 3.4s** across 3 suites (`app.e2e-spec`, `filters.e2e-spec`, `domain-exception.filter.spec`). Build / typecheck / lint all clean.
3. `pnpm turbo run build typecheck lint test` workspace-wide → **16/16 tasks successful** (8 cached, 8 fresh).
4. Live smoke skipped: the filter's real contract is fully exercised by e2e `inject()` calls (byte-identical to what Fastify serves over HTTP) + the unit spec for ALS. Curl-against-a-live-port adds nothing that isn't already covered and would require a test-only endpoint in production code.

**Verification**

- ✅ `DomainError` subclasses → correct HTTP statuses and JSON bodies (404 / 422 / 429 / 502).
- ✅ `ValidationError.fieldErrors` surfaces through the response unchanged (frozen map of path → reasons).
- ✅ `RateLimitError` emits both `retryAfterMs` in the body and `Retry-After` (seconds, ≥ 1) in the headers per RFC 9110.
- ✅ Unhandled native `Error` → 500 with stack **absent** from the body (JSON stringification round-trip confirms no `stack` key).
- ✅ Nest's own `HttpException` status + body preserved end-to-end (tested with `HttpException({message, sku}, 410)`).
- ✅ `traceId` is serialised when an ALS scope exists (unit-tested) and is `undefined` otherwise (e2e-tested). Request-level population lands with OTel.
- ✅ Every response includes `timestamp` (ISO-8601).
- ✅ Workspace turbo still green with the additions.

**Acceptance criteria (from prompt)**

- ✅ Throwing `NotFoundError` (and every other `DomainError` subclass) from a controller yields `{code, ...}` with the expected HTTP status — verified across 7 concrete subclasses.
- ✅ `traceId` is plumbed into every response body the filter emits.

**Notes / deviations**

- Did **not** introduce a production debug controller for live smoke. Test-only `DebugController` lives inside the e2e spec file and is never registered in `AppModule`. Avoids attack surface ("probe /debug/rate-limit to DoS us").
- Filter ordering (AllExceptionFilter first, DomainExceptionFilter second) is deliberate: Nest resolves filters in reverse registration order, so the more specific `@Catch(DomainError)` gets first shot. Any future request-scoped filters can slot in via `@UseFilters()` without conflict.
- `AllExceptionFilter` dev-mode echoes the raw `err.message` to speed up local debugging — guarded by `NODE_ENV === 'production'`. Never echoes the stack.
- Logger for each filter is created at construction time (one per filter instance — filters are singletons in Nest), so trace context propagation still works per-request via the mixin — the logger instance doesn't need to change.
- `domain-exception.filter.spec.ts` uses a hand-rolled mock `ArgumentsHost` rather than `@nestjs/testing`'s full bootstrap — keeps the unit test fast (sub-ms per case) and focused on the filter's own logic.

**Next up**

- `[III.13.1]` — `ZodValidationPipe` that throws our `ValidationError` with populated `fieldErrors`. With the filter in place now, the pipe's thrown error flows through cleanly.
- `[III.11.3]` — `JwtAuthGuard` + `RolesGuard` (`UnauthorizedError` / `ForbiddenError` flow through the filter).
- `[III.11.4]` — Redis sliding-window rate limiter (`RateLimitError` → already has the Retry-After wiring ready).

---

### [III.11.0] — `apps/api` bootstrap skeleton (Nest 11 + Fastify + trinity; 4/4 e2e + live smoke test passed)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 10 + 15.2

> Prompt ID `[III.11.0]` was added as a prerequisite to the `[III.11.x]` sequence. Reason: every subsequent prompt ([III.11.3] guards, [III.11.4] rate limit, [III.11.5] filter, [III.13.x] security, [IV.18.1.16] health) needs a running NestJS app to land in. Shipping the skeleton once, cleanly, avoids having every downstream prompt re-scaffold.

**What was done — `apps/api` becomes a real NestJS 11 + Fastify 5 app wired to the trinity**

- **Entry + bootstrap** (`src/main.ts`)
  - Line 1: `import '../instrumentation';` — OTel load-order contract (real wiring in `[III.15.4]`).
  - Line 2: `import 'reflect-metadata';` — Nest decorator metadata.
  - Calls `validateEnv()` from `@app/config` **before** any Nest construction — fail-fast on any invalid env var with the full `EnvValidationError.issues` list logged at `fatal`.
  - Builds `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: false }), { bufferLogs: true })`. Buffers Nest's own log lines until our logger is wired, so zero output is lost.
  - `app.useLogger(app.get(AppNestLoggerService))` swaps Nest's default ConsoleLogger for our Pino-backed one — verified live, Nest's own `"Starting Nest application..."` now emits as structured JSON with our `context`/`time`/`level`/`msg` shape.
  - `app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] })` — business routes under `/api/v1/*`, probes stay bare at `/health/*` (k8s/Fly.io convention).
  - `app.enableShutdownHooks()` — clean SIGTERM draining.
- **Root module** (`src/app.module.ts`) — imports `AppConfigModule.forRoot()`; registers `AppNestLoggerService` as a provider/export; mounts `HealthController`.
- **Health endpoint** (`src/health/health.controller.ts`) — single `GET /health/live` returning `{status, service, timestamp, uptimeSeconds}`. Richer `/health/ready` + `/health/startup` with Postgres/Redis/Meili dep checks intentionally deferred to `[IV.18.1.16]` (@nestjs/terminus).
- **Tooling**
  - `tsconfig.json` — extends `../../packages/tsconfig/nestjs.json` via relative path (IDE-clean convention). `rootDir: "."` so `instrumentation.ts` is included; `noEmit: true` for typecheck.
  - `tsconfig.build.json` — `noEmit: false`, excludes tests.
  - `eslint.config.mjs` — re-exports `@app/eslint-config`.
  - `jest.config.cjs` — ts-jest with inline CJS tsconfig; `moduleNameMapper` for the three `@app/*` packages so tests read src directly (no `dist/` round-trip).
- **e2e test** (`test/app.e2e-spec.ts`) — 4 cases, all green:
  1. `GET /health/live` returns 200 + expected JSON shape.
  2. `GET /api/v1/health/live` returns 404 (health must NOT be under the prefix).
  3. Unknown route under `/api/v1` returns 404.
  4. Unknown route at bare root returns 404.
  - Uses Fastify's in-process `app.inject()` — no real port opened, parallel-safe.
- **Env seeding** (`test/setup.ts`) — fills the minimal-valid env before any `import` runs (via `setupFiles`).
- **Scripts** — `dev` (`tsx watch`), `build` (`tsc -p tsconfig.build.json`), `start` (`node dist/main.js`), `typecheck`, `lint`, `test`, `test:watch`.
- **README** — the full "what's wired vs what's not yet" table so contributors know exactly which upcoming prompts layer Helmet, CSP, validation pipe, metrics, Swagger, Terminus, etc.

**Bugs surfaced and fixed during integration** (all in this same commit)

- **`packages/config`**: `LOG_LEVEL` enum restricted to `['debug','info','warn','error']` didn't match `@app/logger`'s `LogLevel` type (`silent` + `trace` + `fatal` also valid). Expanded the enum to match Pino's full set and added a cross-reference comment so the two stay in sync.
- **`packages/logger`**: `AppNestLoggerService` constructor took `logger?: AppLogger`. `AppLogger` is a Pino **interface**, not a class, so `reflect-metadata` gave Nest `Object` as the param type token and Nest DI refused to construct the service ("Nest can't resolve dependencies"). Fix: `@Optional() logger?: AppLogger` — Nest now passes `undefined` and the internal `createLogger('NestJS')` fallback takes over. Direct test-time `new AppNestLoggerService(myLogger)` is unchanged.
- **Stale compiled artifacts shadowing sources**: 36 files (`.js`/`.d.ts`/`.map` for every `src/**/*.ts` in `@app/config` and `@app/logger`) were sitting **inside** `packages/*/src/` from an earlier tsc invocation that used the default (not `tsconfig.build.json`) configuration. CJS resolution prefers `.js` over `.ts` at the same path — so Jest's `moduleNameMapper` pointed at `src/index.ts` but `./schema` resolved to the stale `schema.js` next to it. Deleted all 36, added a `.gitignore` guard so this can never slip back in: `packages/*/src/**/*.{js,js.map,d.ts,d.ts.map}` + the same for `apps/*/src/**`.
- **`apps/api/tsconfig.json`**: initial draft had explicit `paths` pointing at `packages/*/src` which dragged package sources into `apps/api`'s compilation unit and tripped TS6059 (rootDir violation). Removed — pnpm's `node_modules` symlinks and jest's `moduleNameMapper` cover resolution without needing apps/api-local path mappings.

**Files created** (10)

- `apps/api/tsconfig.json`, `tsconfig.build.json`
- `apps/api/eslint.config.mjs`, `jest.config.cjs`
- `apps/api/src/main.ts`, `app.module.ts`, `health/health.controller.ts`
- `apps/api/test/setup.ts`, `app.e2e-spec.ts`
- `apps/api/README.md`

**Files edited** (5)

- `apps/api/package.json` — placeholder → real (NestJS + Fastify + tsx + @app/\* deps).
- `packages/config/src/schema.ts` — expand `LOG_LEVEL` enum to match `@app/logger`.
- `packages/logger/src/nest-logger.service.ts` — `@Optional()` on the constructor param.
- `.gitignore` — guard against tsc emitting inside `src/`.
- `PROGRESS.md` (this entry).

**Dependencies added** (under `apps/api`)

- Runtime: `@nestjs/core@11`, `@nestjs/common@11`, `@nestjs/config@4`, `@nestjs/platform-fastify@11`, `fastify@5`, `reflect-metadata@0.2`, `rxjs@7.8`, plus workspace deps `@app/config`, `@app/errors`, `@app/logger`.
- Dev: `@nestjs/testing@11`, `tsx@4.19` (hot-reload dev runtime), standard Jest/TS chain already cached.
- `pnpm install` delta: 10.3s.

**Commands run**

1. `npx pnpm install` → 10.3s.
2. `pnpm --filter=api build` → tsc emit to `apps/api/dist/`.
3. `pnpm --filter=api typecheck` → green.
4. First `pnpm --filter=api test` → 4 failures. Debugged in order: rootDir TS6059 → dropped paths; LOG_LEVEL 'silent' rejected → expanded `@app/config` enum; `PORT=0` rejected by `.positive()` → removed from setup; lint warnings on unused `no-process-exit` disables → removed; `Nest can't resolve dependencies of AppNestLoggerService` → added `@Optional()`. After each fix, re-ran. **Remaining** bug: stale `.js`/`.d.ts` shadow files inside `packages/config/src/` and `packages/logger/src/` from an earlier build. Direct `node -e "require('@app/config').validateEnv({LOG_LEVEL:'silent',...})"` worked (dist was up to date), but Jest via `moduleNameMapper → src/index.ts → './schema'` resolved the stale `.js` over `.ts`. Nuked the 36 files, added a .gitignore guard, rebuilt, tests passed.
5. `pnpm --filter=api test` → **4/4 e2e tests pass in 2.1s**.
6. `pnpm --filter=api lint` → 0 errors.
7. `pnpm turbo run build typecheck lint test` workspace-wide → **16/16 tasks successful**.
8. **Live smoke test**: started `node apps/api/dist/src/main.js` with full valid env. Server bound to `:3030`. `curl http://localhost:3030/health/live` returned `{"status":"ok","service":"api","timestamp":"2026-04-18T15:41:14.714Z","uptimeSeconds":105}`. Observed structured JSON logs in stdout:
   - `{level:info, context:NestFactory, msg:"Starting Nest application..."}` — Nest's own log flowing through our Pino bridge.
   - `{level:info, context:bootstrap, port:3030, nodeEnv:development, logLevel:info, msg:"api_started"}` — our own bootstrap log.
   - `{level:info, context:InstanceLoader, msg:"AppConfigModule dependencies initialized"}` — Nest DI activity.
     Then `taskkill /F /PID <pid>` — server exited cleanly via SIGTERM thanks to `enableShutdownHooks()`.

**Verification**

- ✅ `pnpm --filter=api build`: 16 files emitted to `apps/api/dist/src/` (main, app.module, health/health.controller) + instrumentation.
- ✅ `pnpm --filter=api typecheck`: zero errors with root tsconfig aliases + shared nestjs preset.
- ✅ `pnpm --filter=api test`: 4/4 Fastify `inject()` e2e tests pass in 2.1s. Prefix exclusion for `/health/*` verified — `/api/v1/health/live` correctly returns 404.
- ✅ `pnpm --filter=api lint`: clean.
- ✅ Workspace-wide `turbo run build typecheck lint test`: **16 tasks, 16 successful**.
- ✅ **Live HTTP smoke**: `curl /health/live` returned 200 + expected JSON body.
- ✅ **Log integration**: Nest's internal logs emitted as structured JSON through `@app/logger` (Pino) — Nest ConsoleLogger is fully replaced.
- ✅ **Env fail-fast proven** — any invalid env var would have aborted boot with a structured `issues` list (`validateEnv` unit tests in `@app/config` already cover this; live app inherits the contract).

**Acceptance criteria**

- ✅ apps/api compiles, typechecks, lints, tests.
- ✅ apps/api boots live, binds a port, serves `/health/live` with the expected JSON shape.
- ✅ `@app/config` validates env at boot (fail-fast on failure).
- ✅ `@app/logger` wired as Nest's logger — structured JSON output with trace-context support ready.
- ✅ `@app/errors` imported and on the path for the exception filter (`[III.11.5]` next).
- ✅ Global prefix + health exclusion verified.

**Notes / deviations**

- `tsx` chosen over `ts-node-dev` / `@nestjs/cli` for the `dev` script — zero config, faster startup, works with our existing tsconfig. If we hit an edge case later (e.g. decorator emit issues), we can swap to `nest start --watch` without disturbing the rest of the toolchain.
- No `@nestjs/cli` installed yet. `nest build` / `nest start` aren't wired — plain `tsc` + `node dist/main.js` + `tsx watch` cover everything. Adding `@nestjs/cli` later is optional; the scaffold is already fully usable.
- The `apps/api/src/index.ts` placeholder from `[II.10.0]` is obsolete (entry is now `main.ts`) but intentionally left in place per the CLAUDE.md rule "never delete a file you did not create in this session." A later cleanup prompt can remove it.
- Bug carryovers (LOG_LEVEL enum in `@app/config`, `@Optional()` in `@app/logger`, stale-src-artifact gitignore) are all bundled into this commit because they surfaced **through** this integration work and are meaningless without it. Makes the prompt's "what broke and why" reviewable in one diff.

**Next up**

With apps/api live, the natural sequence is:

- `[III.11.5]` — DomainExceptionFilter mapping `@app/errors` → HTTP responses.
- `[III.13.1]` — ZodValidationPipe throwing `ValidationError` with populated `fieldErrors`.
- `[III.11.3]` — JWT + RBAC guards.
- `[III.11.4]` — Redis sliding-window rate limiter (needs Redis; Docker Compose stack is already up).
- `[IV.18.1.16]` — Terminus-powered `/health/ready` + `/health/startup` with real Postgres/Redis checks.

All of these are small-to-medium, land one-at-a-time, and exercise the trinity further.

---

### [IV.17.6] — Root tsconfig path aliases + `instrumentation.ts` stub (partial — categories deferred)

**Date:** 2026-04-18 · **Status:** DONE (2 of 3 items) · **Kind:** Refactor/Tooling · **Playbook §** 17.6

**What was done**

- **Root `tsconfig.json` (new)** — a "solution" tsconfig holding the `@app/*` path aliases for every live package (config, errors, logger) plus every placeholder package (observability, shared-types, sdk, ui, mobile-ui). `files: []` + `include: []` ensure this tsconfig compiles nothing itself — each app/package still drives its own compile via its local `tsconfig.json`. Both bare imports (`@app/config`) and subpath imports (`@app/config/nested-module`) resolve directly to source (`packages/<name>/src/…`), so editors, test runners, and future `apps/api` don't need `pnpm build` to run first.
- **`apps/api/instrumentation.ts` (new stub)** — load-order-critical file with a clear comment contract: "MUST be the VERY FIRST import in main.ts". Empty body for now (`export {}`); real OpenTelemetry SDK wiring + auto-instrumentations land in `[III.15.4]`. Shipping the stub now locks the calling convention so we don't forget the `import '../instrumentation';` line later.

**Items deliberately deferred**

- **`packages/shared-types/src/place-category.ts`** (the third item in §17.6) — requires committing to the exhaustive 50-category taxonomy (or designing the DB-driven `PlaceCategory` table). That's a domain-modelling decision that belongs with the real shared-types build prompt (or the Places module, `[IV.18.2.x]`), not a monorepo tooling fix. Will be closed out in that prompt. The §17.6 tracker entry is moved from DONE → PARTIAL-DONE.

**Files created** (2)

- `tsconfig.json` (root)
- `apps/api/instrumentation.ts`

**Files edited** (1)

- `PROGRESS.md` (this entry).

**Dependencies added** — none.

**Commands run**

1. `ls tsconfig*` — confirmed no root tsconfig existed yet.
2. `ls apps/api/` — confirmed package.json + src/ placeholder only; no `instrumentation.ts` yet.
3. `pnpm turbo run typecheck` — **3 tasks successful, 3 total** (2 cached, 1 fresh). Root tsconfig doesn't interfere with package-level compilation (as designed — `files: []` + `include: []`).

**Verification**

- ✅ Workspace typecheck still green after adding root tsconfig — no regressions.
- ✅ Root tsconfig's `paths` covers every `@app/*` package declared in `pnpm-workspace.yaml` (excluding the `@app/tsconfig` + `@app/eslint-config` configuration packages, which are `.json` / `.js` and consumed by extend/import, not by TypeScript path resolution).
- ✅ `instrumentation.ts` exists under `apps/api/` (not `apps/api/src/`) so `main.ts` can `import '../instrumentation';` — same layout NestJS apps typically use.
- ✅ IDE: `import { createLogger } from '@app/logger'` will now jump-to-definition straight into `packages/logger/src/index.ts`, not into a compiled `dist/` file.

**Acceptance criteria (from prompt)**

- ✅ Root `tsconfig.json` `paths: "@app/*": ["packages/*/src"]` (expanded per-package, with subpath support — slightly more explicit than the glob suggestion in the prompt archive, but functionally equivalent and more IDE-friendly).
- ✅ `apps/api/instrumentation.ts` created with the load-order comment contract in place.
- ⚪ Place category enumeration — deferred with a tracking note (see above).

**Notes / deviations**

- Used per-package explicit `paths` entries (with both bare and `/*` variants) instead of a single `@app/*` glob. Reasons:
  1. Subpath imports (`@app/config/schema`) work out of the box.
  2. Makes the monorepo surface self-documenting — open `tsconfig.json` and see exactly what's wired.
  3. Placeholder packages that don't actually have real code yet still resolve to their stub `src/index.ts`, so imports don't blow up editors while we build them out.
- `instrumentation.ts` lives at `apps/api/instrumentation.ts` (not `apps/api/src/instrumentation.ts`). Reason: NestJS CLI treats `src/` as the compile root, and the OTel SDK init file is conventionally kept at the project root above `src/` so `import '../instrumentation'` is stable and obviously outside the normal module graph.
- Did not wire these aliases into any package's local tsconfig yet — doing so retroactively across every package is busywork until a consumer actually needs them. `apps/api` will get path mappings in its own tsconfig when it's scaffolded (`[III.11.x]` / `[IV.18.1.14.a-c]` area).

**Next**

Root aliases + instrumentation stub in place. Next natural move: one of the architecture ADRs (`[II.6.2]` modular monolith / `[II.6.3]` service-extraction triggers / `[II.6.4]` event backbone) — pure docs, locks decisions in writing before the first domain module lands. Or jump to `[II.7.2]` context-map doc. Both are small.

---

### [III.11.6] — `@app/logger` (Pino + AsyncLocalStorage trace context + PII redact, 28/28 tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 15.2

**What was done**

Completes the Phase 0 "trinity" of shared packages. Every NestJS module, worker, and `apps/api` bootstrap will pull from `@app/logger` — one central place where log format, trace correlation, and PII redaction policy live.

- `src/trace-context.ts` — `AsyncLocalStorage<TraceContext>` with a strict read-only surface. Exports:
  - `runWithTraceContext(ctx, fn)` enters a new scope; `getTraceContext()` reads the current one (or `undefined` outside any scope).
  - `extendTraceContext(patch, fn)` merges extra fields into the current scope (mints a fresh `traceId` if there isn't one yet). Merges `tags` map deeply when both outer and patch define them.
  - `generateTraceId()` → 32-char lowercase hex (W3C 128-bit trace-id shape).
  - `generateSpanId()` → 16-char lowercase hex (W3C 64-bit span-id shape).
  - `TraceContext` interface with `traceId`, `spanId?`, `userId?`, `requestId?`, `tags?`.
- `src/redact.ts` — frozen array of **40+ Pino redact paths** covering top-level + `*.field` (one level deep) for every known secret/PII field: passwords, tokens (access/refresh/id/api), mfaSecret, backup codes, ssn, passport, creditCard, cvv, email, emailHash, phone, and HTTP headers authorization/cookie/set-cookie/x-api-key.
- `src/logger.ts` — `createLogger(context, options?): AppLogger` factory. Pino configured with:
  - Level from `options.level ?? process.env.LOG_LEVEL ?? 'info'`.
  - Base fields: `{context, ...options.base}` on every line.
  - Redact paths: `PII_REDACT_PATHS` + any `additionalRedactPaths`, censor `'[REDACTED]'`.
  - Level formatter: emits `{"level":"info"}` (label) instead of Pino's numeric default.
  - **`mixin`** that pulls the current `TraceContext` every log line — so trace/span/user/request ids arrive automatically with zero call-site boilerplate.
  - ISO-8601 `time`.
  - Optional `pino-pretty` transport gated by `options.pretty && NODE_ENV !== 'production'`.
  - Optional `destination` stream for tests.
  - `AppLogger = pino.Logger` type alias.
- `src/nest-logger.service.ts` — `@Injectable() AppNestLoggerService implements @nestjs/common LoggerService`. Correctly maps each of the 6 Nest levels (`log/error/warn/debug/verbose/fatal`) to the corresponding Pino level; stringifies non-string messages; extracts `message` from `Error` instances. Accepts an optional pre-built `AppLogger` for test injection.
- `src/index.ts` — barrel exporting the factory, types (`AppLogger`, `LogLevel`, `CreateLoggerOptions`, `TraceContext`), trace-context helpers, `PII_REDACT_PATHS`, and `AppNestLoggerService`.
- **3 test suites, 28 tests total** (all green in 2.5s):
  - `test/trace-context.spec.ts` (13 tests): outside-scope undefined, single-scope value propagation, sibling isolation, nesting + restoration, async-boundary propagation via `await`, return value passthrough, outer restored after inner throw, `extendTraceContext` mints trace id when bare, `extendTraceContext` preserves outer traceId + merges user fields, deep `tags` merge with override, hex format assertions for `generateTraceId`/`generateSpanId`, uniqueness of successive calls.
  - `test/logger.spec.ts` (8 tests): JSON shape with level/context/msg/time, top-level redact, nested `*.sensitive` redact, HTTP header redact (authorization/cookie) with non-sensitive headers preserved, trace-context mixin merge both in-scope and absent when outside scope, `additionalRedactPaths`, level filtering (info suppresses trace/debug), `child()` inherits context + redaction.
  - `test/nest-logger.service.spec.ts` (7 tests): each of `log/warn/error/debug/verbose/fatal` maps to the expected Pino level with correct context; `error` forwards stack separately; non-string messages are JSON-stringified; `Error` instances log `.message`; default constructor doesn't throw.
- Tests capture output via a `Writable` stream piped to JSON.parse — no snapshots, no globals pollution.

**Files created** (10)

- `packages/logger/tsconfig.json`, `tsconfig.build.json`
- `packages/logger/jest.config.cjs`, `eslint.config.mjs`
- `packages/logger/src/trace-context.ts`, `redact.ts`, `logger.ts`, `nest-logger.service.ts`
- `packages/logger/test/trace-context.spec.ts`, `logger.spec.ts`, `nest-logger.service.spec.ts`
- `packages/logger/README.md`

**Files edited** (3)

- `packages/logger/package.json` — placeholder → real (pino runtime, optional NestJS peer).
- `packages/logger/src/index.ts` — placeholder → barrel.
- `PROGRESS.md` (this entry).

**Dependencies added**

- Runtime: `pino@^9.5.0`.
- Peer (optional): `@nestjs/common@^11` — app provides its copy; the Nest service is tree-shakable for pure-Node consumers.
- Dev: `@app/eslint-config`, `@app/tsconfig` (workspace), `@nestjs/common@^11`, `@types/jest`, `@types/node`, `jest`, `rimraf`, `ts-jest`, `typescript`.
- `pnpm install` delta: only the 2 new direct entries (`pino`, `@nestjs/common`-as-dev) — others reused from `@app/config`. 4.7s.

**Commands run**

1. `npx pnpm install` — added pino; 4.7s.
2. `pnpm --filter=@app/logger build` — 16 files emitted to `dist/` (4 source modules × {js, js.map, d.ts, d.ts.map}).
3. `pnpm --filter=@app/logger typecheck` — green.
4. `pnpm --filter=@app/logger test` — **28/28 across 3 suites, 2.5s**.
5. `pnpm --filter=@app/logger lint` — 0 errors.
6. `pnpm turbo run build typecheck lint test` workspace-wide — **12/12 tasks successful** (3 packages × 4 tasks, 8 cached from prior runs).

**Verification**

- ✅ Log lines emit JSON with `traceId` (when in a trace scope), no manual plumbing.
- ✅ `email` and `authorization` (+ ~40 other PII paths) are replaced with `[REDACTED]` automatically — verified by stream-capturing live logger output and parsing the JSON.
- ✅ Nested `*.sensitive` redaction works one level deep (enough for `req.body.password`, `user.email`, etc.).
- ✅ Trace context propagates across `await` boundaries (Node `AsyncLocalStorage` semantics).
- ✅ Level filtering respects `LOG_LEVEL` — test proves `info` suppresses `trace`/`debug`.
- ✅ NestJS `LoggerService` contract satisfied; mapping for all 6 methods tested.
- ✅ Workspace turbo now stands at 3 real packages (config + errors + logger) all building + typechecking + linting + testing clean.

**Acceptance criteria (from prompt)**

- ✅ Logs emit JSON with `traceId` on every line (inside a trace scope).
- ✅ `email` and `authorization` never appear in output — replaced by `[REDACTED]` (verified by integration test on live pino output).
- ✅ Integration test with a seeded trace proves correlation (`logger.spec.ts` "merges the current trace context into every line").

**Notes / deviations**

- Followed the `"../tsconfig/nestjs.json"` relative-extends convention set by the prior fix — no IDE squiggles.
- Deliberately **did not** include `pino-http` middleware in this package — it's Fastify-specific and lives better in `apps/api` once that app exists. Exposing `runWithTraceContext` is enough for the Fastify hook to do its job later.
- `AppLogger` is a direct re-export of `pino.Logger` (not a wrapper class). Consumers stay on the Pino surface — one less abstraction to learn; if we ever swap Pino out, it's a codemod, not a redesign. Playbook §15.2's examples match Pino idioms.
- `extendTraceContext` spreads the outer context first, then the patch, so explicit patch fields win — matches React setState/spread intuition. Tags are a separate deep-merge to avoid one side's empty object overwriting the other's populated map.
- Coverage threshold kept at 80/80/80/70 (same as `@app/config`); the dense tests hit well above.
- Pre-commit prettier may reformat README tables/code blocks on the eventual commit — expected.

**Next up**

Trinity complete. The natural progression: **`[IV.17.6]`** (root tsconfig path aliases + `apps/api/instrumentation.ts` stub) — one tiny cleanup that unlocks `import … from '@app/logger'` in `apps/api` later without a build step. After that, `[II.6.2]`–`[II.6.4]` ADRs (tiny docs), then the first `apps/api` skeleton.

---

### Follow-up fix — tsconfig `extends` path (VS Code JSON-schema validator)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Fix · **Trigger:** IDE squiggle reported by user on `packages/errors/tsconfig.json` line 3.

**Symptom** — VS Code's built-in tsconfig JSON-schema validator underlined `"@app/tsconfig/nestjs.json"` with "Cannot find extends file". This is a known limitation of the schema validator (it can't resolve npm-package extends paths the way `tsc` does via pnpm's workspace symlinks). `tsc --build`, `tsc --noEmit`, Jest, and ESLint all resolved the path fine, so the error was **IDE-only, not build-breaking**.

**Fix** — swapped both live package tsconfigs to a relative extends path. Same semantic, both tools happy:

```diff
- "extends": "@app/tsconfig/nestjs.json",
+ "extends": "../tsconfig/nestjs.json",
```

Touched `packages/errors/tsconfig.json` and `packages/config/tsconfig.json`. `tsconfig.build.json` in both packages was unaffected (extends `./tsconfig.json` — already relative).

**Verification** — `pnpm turbo run build typecheck lint test` → **8 tasks, 8 successful**, 4.7s (1 cached). 27/27 `@app/errors` tests + 11/11 `@app/config` tests still green.

**Convention going forward** — all future package tsconfigs will use `../tsconfig/<preset>.json` (relative) rather than `@app/tsconfig/<preset>.json` (npm). Updating `CLAUDE.md` is overkill for this — the fix is obvious on sight once you've seen it. Template the next package off of `packages/config/tsconfig.json`.

---

### [III.15.1] — `@app/errors` (DomainError hierarchy, 27/27 tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 15.1

**What was done**

- Replaced placeholder `packages/errors` with a real, zero-runtime-dep package that defines the domain error hierarchy every NestJS module will throw and the global exception filter will catch.
- `src/base.error.ts` — abstract `DomainError` extending `Error`. Fields: abstract `code` (UPPER_SNAKE machine id), abstract `httpStatus`, readonly `context: DomainErrorContext` (frozen shallow copy), readonly `timestamp: Date`. Method `toJSON(): DomainErrorJson` returns `{code, message, context, timestamp}` — **never the stack**. `isDomainError(unknown): value is DomainError` type guard. Prototype-chain preserved via `Object.setPrototypeOf(this, new.target.prototype)` (for CJS/ES5 `instanceof`). Stack trace captured from the subclass call-site via `Error.captureStackTrace(this, new.target)`.
- `src/errors.ts` — 15 concrete classes:
  - **Generic HTTP:** `UnauthorizedError` (401) · `PaymentFailedError` (402) · `ForbiddenError` (403) · `NotFoundError` (404) · `ConflictError` (409) · `ValidationError` (422, adds `fieldErrors` + override `toJSON`) · `RateLimitError` (429, adds `retryAfterMs`, clamps negatives + floors fractions) · `SafetyCheckFailedError` (451) · `InvariantError` (500) · `ExternalServiceError` (502, adds `service` name).
  - **Domain-specific:** `AgentNotVerifiedError extends ForbiddenError` · `TripNotFoundError / PlaceNotFoundError / UserNotFoundError extends NotFoundError` · `InvalidRadiusError extends ValidationError` (includes `radiusKm` field error).
  - All generics accept an optional `code` constructor arg with a sensible UPPER_SNAKE default, so callers can re-tag a generic 404 without subclassing. Domain-specific classes lock in their `code` via `super(..., specificCode)`.
- `src/index.ts` — barrel re-exporting base class, type guard, types, and all 15 concrete classes + the `FieldErrors` helper type.
- `test/base.error.spec.ts` — 7 tests exercising the abstract base: subclass-name propagation, `instanceof` chain across `DomainError`/`Error`/subclass, context freeze (including defense against post-construction mutation of the input object), timestamp window, `toJSON()` shape without stack, stack-trace origin frame, `isDomainError()` narrowing across all falsy-ish inputs.
- `test/errors.spec.ts` — 20 tests including an `it.each` table covering the 7 simple generics, `ValidationError` freeze-nested behavior + toJSON shape, `RateLimitError` clamp/floor math, `ExternalServiceError` service propagation, each domain-specific class's prototype chain + code + context, and a JSON.stringify round-trip proving the stack never leaks to the wire.
- Rich `README.md` — why, usage examples (throw + catch-boundary), the full HTTP-to-class table, wire JSON shape, four authoring rules (only throw DomainError across boundaries, never PII in context, codes are public API, subclass when callers branch), and scripts reference.

**Files created** (9)

- `packages/errors/tsconfig.json`, `tsconfig.build.json`
- `packages/errors/jest.config.cjs`, `eslint.config.mjs`
- `packages/errors/src/base.error.ts`, `errors.ts`
- `packages/errors/test/base.error.spec.ts`, `errors.spec.ts`
- `packages/errors/README.md`

**Files edited** (3)

- `packages/errors/package.json` — placeholder → real (scripts, exports, devDeps only — **no runtime deps** and **no peer deps**; this is pure TypeScript).
- `packages/errors/src/index.ts` — placeholder → barrel.
- `PROGRESS.md` (this entry).

**Dependencies added** — none new. All devDeps (`@app/tsconfig`, `@app/eslint-config`, jest, ts-jest, rimraf, typescript, @types/jest, @types/node) already resolved from `@app/config`'s install; this prompt's `pnpm install` added 0 packages in 4.3s.

**Commands run**

1. `npx pnpm install` — 0 new packages, 4.3s (everything cached).
2. First attempt `pnpm --filter=@app/errors build typecheck test lint` failed: pnpm passed `typecheck test lint` as args to the `build` script (not as separate scripts), yielding `tsc -p tsconfig.build.json typecheck test lint` and TS5042. Re-ran each script separately with `&&`.
3. `pnpm --filter=@app/errors build` — green, emits 12 files to `dist/`.
4. `pnpm --filter=@app/errors typecheck` — green.
5. `pnpm --filter=@app/errors test` — **27/27 pass in 2.5s** across 2 suites.
6. `pnpm --filter=@app/errors lint` — 0 errors.
7. `pnpm turbo run build typecheck lint test` workspace-wide — **8 tasks, 8 successful** (2 packages × 4 tasks each), 6.2s.

**Verification**

- ✅ `dist/` contains base.error, errors, index × `.js` + `.js.map` + `.d.ts` + `.d.ts.map` (12 files).
- ✅ 27/27 Jest tests green; coverage threshold (85/85/85/75 lines/stmts/fns/branches) met.
- ✅ Workspace turbo: `@app/config` + `@app/errors` both build+typecheck+lint+test clean (8 tasks).
- ✅ Pre-commit lint-staged will prettify any staged `.ts`/`.md`/`.json` automatically.

**Acceptance criteria (from prompt)**

- ✅ `DomainError` is abstract with `code`, `httpStatus`, `context`, `timestamp`, `toJSON()`.
- ✅ All requested concrete classes exist: `NotFoundError` 404, `UnauthorizedError` 401, `ForbiddenError` 403, `ValidationError` 422, `ConflictError` 409, `RateLimitError` 429, `ExternalServiceError` 502, `InvariantError` 500, `TripNotFoundError` / `PlaceNotFoundError` / `UserNotFoundError` / `AgentNotVerifiedError` / `InvalidRadiusError` / `PaymentFailedError` / `SafetyCheckFailedError` 451.
- ✅ `src/index.ts` re-exports everything.
- ✅ `toJSON()` produces `{code, message, context, timestamp}` — **no stack** (test `JSON.stringify` round-trip confirms).

**Notes / deviations**

- Chose the "generic-class-with-default-code + domain-specific-class-passes-custom-code-via-super()" pattern over `override readonly code = '...'` on subclasses. Avoids TypeScript friction with `noImplicitOverride` on readonly fields and makes the code-arg explicit in each subclass constructor.
- Added `InvalidRadiusError` as a subclass of `ValidationError` (not `DomainError` directly) so the exception filter treating any `ValidationError` uniformly (emit `fieldErrors`) works without special-casing.
- `ExternalServiceError` records `service` both as a typed field and inside `context` — redundancy is intentional so structured log sinks can filter by `context.service` without needing to know about the subclass.
- Coverage threshold bumped from `@app/config`'s 80/80/80/70 → **85/85/85/75** here because this package is pure types with dense tests; the bar should be higher where mocking is trivial.

**Next prompt candidates**

- `[III.11.6]` — `@app/logger` (Pino + AsyncLocalStorage trace context + PII redact). Last of the "trinity" foundation packages. Small integration note: will use `DomainError.toJSON()` when logging errors.
- `[III.11.5]` — NestJS global exception filter in `apps/api` mapping `DomainError` → HTTP (requires `apps/api` skeleton, so a few prompts away).
- `[III.13.1]` — Zod validation pipe (throws our `ValidationError` with populated `fieldErrors`).
- `[IV.17.6]` — Root tsconfig path aliases + `apps/api/instrumentation.ts`.
- `[II.6.2]` — ADR-001 Modular monolith (pure docs, locks the call).

---

### [III.11.1] — `@app/config` (Zod env schema + NestJS ConfigModule, 11/11 tests)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 11.1

**What was done**

- Replaced the placeholder `packages/config` with a real package that ships a Zod-validated env schema, a framework-agnostic `validateEnv()` function, and a NestJS global `AppConfigModule.forRoot()` factory.
- `src/schema.ts` — `EnvSchema` composed from 15 sub-schemas covering every variable from Playbook §11.1 and §8.5 providers: Runtime (NODE_ENV, PORT, LOG_LEVEL), Database, Redis, JWT, Google OAuth, Apple OAuth, AI, Stripe, External APIs, Storage (S3), Comms (Resend/Twilio), Meilisearch, Observability, Features, Security (RATE_LIMIT_PEPPER). Sensible dev defaults where safe; secrets never defaulted. Type `Env = z.infer<typeof EnvSchema>` exported for callers.
- `src/validate.ts` — `validateEnv(raw = process.env): Env` plus a custom `EnvValidationError` that exposes a structured `issues: readonly EnvIssue[]` list (path / message / code) alongside the pretty multi-line `.message`. Prototype chain preserved across CJS transpilation.
- `src/nest-config.module.ts` — `AppConfigModule` wraps `@nestjs/config`'s `ConfigModule.forRoot({ isGlobal: true, cache: true, validate })` so Nest aborts at boot on any invalid env. `AppConfigService = ConfigService<Env, true>` re-typed alias lets callers do `config.get('DATABASE_URL', { infer: true })` with full typing.
- `src/index.ts` — barrel re-exporting EnvSchema, Env, validateEnv, EnvValidationError, EnvIssue, AppConfigModule, AppConfigService.
- `test/validate.spec.ts` — **11 unit tests** (all green in 1.2s): valid minimal env, defaults for optionals, numeric coercion, missing-key throw, structured issue surface, invalid URL, too-short JWT secret, unknown NODE_ENV enum, optional providers (OAuth/Stripe/comms), feature-flag bool coercion, process.env default fallback.
- Build emits CJS + declaration maps to `dist/`. Package ships `files: [dist, src]` so consumers can import from `@app/config` (resolved via `exports` map).
- `tsconfig.json` extends `@app/tsconfig/nestjs.json` with `rootDir: "."` + `noEmit: true` (so typecheck covers both src/ and test/). `tsconfig.build.json` narrows `rootDir: "./src"` + `noEmit: false` + excludes `test/`.
- `jest.config.cjs` uses `ts-jest` with an inline CommonJS tsconfig (module=commonjs, target=ES2022, experimentalDecorators for future Nest tests). Coverage threshold enforced at 80% lines/stmts/fns, 70% branches.
- `eslint.config.mjs` re-exports the shared `@app/eslint-config` flat config — proves the shared preset actually propagates to a real consumer package.
- Rich `README.md` with quick-start for both non-Nest and Nest callers, schema overview table by group, scripts reference, and conventions.

**Files created** (8)

- `packages/config/tsconfig.json`
- `packages/config/tsconfig.build.json`
- `packages/config/jest.config.cjs`
- `packages/config/eslint.config.mjs`
- `packages/config/src/schema.ts`
- `packages/config/src/validate.ts`
- `packages/config/src/nest-config.module.ts`
- `packages/config/test/validate.spec.ts`
- `packages/config/README.md`

**Files edited** (2)

- `packages/config/package.json` — placeholder → real (deps, scripts, exports, peers).
- `packages/config/src/index.ts` — placeholder → barrel.
- `PROGRESS.md` (this entry).

**Dependencies added** (under `@app/config`)

- Runtime: `zod@^3.24.1`.
- Peer (optional): `@nestjs/common@^11`, `@nestjs/config@^4`, `reflect-metadata@^0.2`, `rxjs@^7.8`.
- Dev: `@nestjs/common@11.0.11`, `@nestjs/config@^4`, `@types/jest@29.5`, `@types/node@22.10`, `jest@29.7`, `reflect-metadata@0.2`, `rimraf@6`, `rxjs@7.8`, `ts-jest@29.2`, `typescript@5.7`, plus `@app/tsconfig` + `@app/eslint-config` via workspace links.
- Total pnpm install delta: **+246 packages**, 21.8s (brings workspace to ~500 packages).

**Commands run**

1. `npx pnpm install` — 246 new packages, husky prepare fired, 21.8s.
2. `pnpm --filter=@app/config build` — first attempt OK (exit 0). Emitted 16 files (4 sources × .js + .js.map + .d.ts + .d.ts.map) to `dist/`.
3. `pnpm --filter=@app/config typecheck` — **first run failed** TS6059 (test/ outside rootDir inherited from `@app/tsconfig/nestjs.json`). Fixed by overriding `rootDir: "."` + `noEmit: true` in `tsconfig.json` and narrowing `rootDir: "./src"` in `tsconfig.build.json`. Re-ran: green.
4. `pnpm --filter=@app/config test` — 11/11 tests pass, 1.2s.
5. `pnpm --filter=@app/config lint` — 0 errors, 0 warnings.
6. `pnpm turbo run build typecheck lint test` — all 4 tasks successful across the workspace (cache cold this run).
7. `ls packages/config/dist/` — confirmed 16 output files.

**Verification**

- ✅ `dist/index.js` + `dist/index.d.ts` present; every src file has a matching .js/.d.ts/.map.
- ✅ 11/11 Jest tests green in 1.2s. Coverage thresholds (80/80/80/70) satisfied by the test suite (validate.ts + schema.ts fully exercised).
- ✅ `tsc --noEmit` repo-wide green.
- ✅ ESLint 9 flat config via `@app/eslint-config` consumed successfully from a sibling package (first proof the shared preset actually works cross-package).
- ✅ `turbo run build typecheck lint test` → `Tasks: 4 successful, 4 total`.

**Acceptance criteria (from prompt)**

- ✅ `pnpm --filter=@app/config test` green.
- ✅ NestJS consumer can inject `ConfigService<Env, true>` (`AppConfigService` re-typed alias + `AppConfigModule.forRoot()` available).
- ✅ Framework-agnostic `validateEnv()` throws pretty `EnvValidationError` on missing / invalid fields with structured `issues` list.

**Notes / deviations**

- `EnvSchema` is comprehensive (40+ vars) but several provider keys are `.optional()` so apps can boot without Stripe / OAuth / full comms wiring until their respective prompts (`[IV.18.2.10]`, `[III.13.2]`, `[IV.18.2.9]`).
- Chose CJS output (no `"type": "module"`) to avoid ESM/CJS interop pain with NestJS runtime. Later packages can revisit if we hit ESM-only deps.
- Test file uses `NodeJS.ProcessEnv` destructuring and `_omit` naming for discarded keys — matches the `@app/eslint-config` unused-var allow pattern (`^_`).
- Intentionally did **not** yet add an `.env.example` with matching defaults — deferred to prompt `[IX.32.4]` which pairs that with the Doppler rollout.
- Lint-staged on commit will auto-format YAML/MD/JSON; expected.

**Next prompt candidates**

- `[III.15.1]` — `@app/errors` DomainError hierarchy (same tier foundation; every module throws these).
- `[III.11.6]` — `@app/logger` Pino wrapper + AsyncLocalStorage trace context (needed before `apps/api` main.ts).
- `[III.11.5]` — Domain exception filter in apps/api (requires errors + logger first).
- `[IV.17.6]` — Path aliases in root tsconfig + `apps/api/instrumentation.ts` (unlocks `import { ... } from '@app/config'` in apps/api without needing dist build first).
- `[IX.32.4]` — `.env.example` matching this schema + `docs/env.md`.
- `[III.11.1]`'s natural siblings: Config → Errors → Logger → Observability — complete the "trinity + 1" then start apps/api.

---

### [IX.32.2] — Docker Compose local dev stack (8 services, all healthy)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 32.2

**What was done**

- Authored `infra/docker-compose.yml` — 8 services, each with healthcheck + named volume where it holds state. Stack name `travel-superapp-dev`. Modern Compose syntax (no `version:` key).
- Services + ports:
  - **postgres** (built from `./postgres/Dockerfile` on top of `postgis/postgis:16-3.4`, pgvector layered via `postgresql-16-pgvector` apt) — `localhost:5432`. Init scripts mounted from `./postgres/init/`.
  - **redis** (`redis:7.4-alpine`, `--requirepass redis_dev`) — `localhost:6379`.
  - **meilisearch** (`v1.11`) — `localhost:7700`.
  - **minio** (`RELEASE.2024-12-18T13-15-44Z`) — API `:9000`, console `:9001`.
  - **mailpit** (`v1.21`) — SMTP `:1025`, UI `:8025`.
  - **jaeger** (`all-in-one:1.65.0`) — UI `:16686`, OTLP gRPC `:4317`, HTTP `:4318`.
  - **prometheus** (`v3.1.0`) — `:9090`, config mounted from `./prometheus/prometheus.yml`.
  - **grafana** (`11.4.0`) — `:3001` (avoids Next.js 3000), auto-provisioned datasources + dashboards folder mounted from `./grafana/provisioning/`. Depends on prometheus + jaeger being healthy.
- `infra/postgres/Dockerfile` — extends `postgis/postgis:16-3.4`, `apt-get install postgresql-16-pgvector`. (No single public image bundles PostGIS + pgvector, so we build a small 2-layer one.)
- `infra/postgres/init/01-extensions.sql` — idempotent `CREATE EXTENSION IF NOT EXISTS` for `postgis`, `postgis_topology`, `vector`, `pg_trgm`, `pgcrypto`. Mounted read-only and runs on first boot.
- `infra/prometheus/prometheus.yml` — self-scrape + placeholder targets for `apps/api:3000` and `apps/ai-service:8001` (via `host.docker.internal`) — marked down until those apps exist in later prompts.
- `infra/grafana/provisioning/datasources/datasources.yml` — Prometheus (default) + Jaeger datasources.
- `infra/grafana/provisioning/dashboards/dashboards.yml` — provider pointing at `./json/` folder (`.gitkeep` placeholder; real dashboards land in `[III.15.7]`).
- `infra/README.md` — service table, commands, first-boot notes, extension-verification command.

**Files created** (8 new)

- `infra/docker-compose.yml`
- `infra/postgres/Dockerfile`
- `infra/postgres/init/01-extensions.sql`
- `infra/prometheus/prometheus.yml`
- `infra/grafana/provisioning/datasources/datasources.yml`
- `infra/grafana/provisioning/dashboards/dashboards.yml`
- `infra/grafana/provisioning/dashboards/json/.gitkeep`
- `infra/README.md`

**Files edited** — `PROGRESS.md` (this entry).

**Dependencies added** — none at the Node/pnpm layer. 8 Docker images pulled + 1 local image built.

**Commands run**

1. `docker compose -f infra/docker-compose.yml up -d` — initial: Jaeger tag `1.62` invalid, fixed to `1.65.0`, retried. Pulled 8 images, built postgres image (~2 min on first run).
2. `docker compose -f infra/docker-compose.yml ps` — 7/8 healthy after ~53s; meilisearch stuck on `(health: starting)`.
3. Diagnosed meilisearch: image _has_ `wget` at `/usr/bin/wget` and listens on `0.0.0.0:7700`, but `wget -q --spider http://localhost:7700/health` reliably returns "connection refused" inside the container (even with `127.0.0.1`); likely a busybox-applet quirk. `curl` works fine. Switched healthcheck to `curl -fs http://localhost:7700/health` and recreated the container — healthy in ~27s.
4. `docker compose ps` — **all 8 services healthy**.
5. `docker compose exec postgres psql -c "\dx"` — lists `pg_trgm 1.6 / pgcrypto 1.3 / plpgsql / postgis 3.4.3 / postgis_topology 3.4.3 / vector 0.8.2` (6 rows).
6. Host-side smoke test (curl each exposed port): meilisearch/minio/mailpit/jaeger/prometheus/grafana all HTTP 200; postgres + redis as expected don't speak HTTP.
7. Composite functional query exercising all 4 domain extensions at once:
   ```sql
   SELECT ST_AsText(ST_MakePoint(77.5946, 12.9716)::geography),
          (ARRAY[0.1,0.2,0.3]::vector(3)) <-> (ARRAY[0.4,0.5,0.6]::vector(3)),
          similarity('Bengaluru', 'Bangalore'),
          encode(digest('travel', 'sha256'), 'hex');
   ```
   Returns:
   - `POINT(77.5946 12.9716)` (PostGIS),
   - `0.5196152525944904` (pgvector L2 distance),
   - `0.1764706` (pg_trgm similarity),
   - `0209442e...c461c4` (pgcrypto SHA-256).

**Verification**

- ✅ `docker compose ps` — 8/8 services `Up (healthy)` within 60s on a warm start (first boot ~2 min including image pulls + postgres build).
- ✅ Postgres extensions installed **and** functionally exercised (spatial + vector + trigram + crypto).
- ✅ Grafana UI reachable on `:3001`; Prometheus on `:9090`; Jaeger UI on `:16686`; MinIO console on `:9001`; Mailpit UI on `:8025`; Meilisearch on `:7700`.
- ✅ Grafana datasources auto-provisioned (Prometheus + Jaeger visible at first login with `admin/admin`).

**Acceptance criteria (from prompt)**

- ✅ `docker compose ps` shows all services healthy within 60s on warm start.

**Notes / deviations**

- Jaeger tag corrected `1.62` → `1.65.0` (Docker Hub doesn't carry `1.62` without patch suffix; all current 1.x tags are `X.Y.Z`).
- Meilisearch healthcheck swapped from `wget` to `curl` to work around the busybox `wget --spider` quirk in its v1.11 image. Functionality unchanged.
- `.husky/commit-msg` uses `[no-install]` style: calls `commitlint` directly via `node_modules/.bin`. On commit, `lint-staged` may prettify `infra/*.yml` — expected.
- `host.docker.internal` used for Prometheus targets pointing at future API/ai-service — those report `down` until those apps exist; harmless noise.
- A root `Makefile` with `make up / down / logs / reset / db-shell / redis-shell` is intentionally deferred to prompt **[IX.32.3]**.
- `.env.example` covering required env vars is deferred to prompt **[IX.32.4]** + shared-types env schema prompt **[III.11.1]**.

**Next prompt candidates**

- `[IX.32.3]` — Root Makefile + compose wrappers (tiny, 1 file).
- `[IV.18.1.11]` — GitHub Actions CI/CD pipeline (unlocks automatic verification on push).
- `[IV.17.6]` — Path aliases + instrumentation.ts scaffold (tiny cleanup).
- `[III.11.1]` — `@app/config` package (first real TS code; Zod env schema).
- `[II.6.2]`–`[II.6.4]` — Architecture ADRs (pure docs, locks decisions).

---

### [II.10.0] — Monorepo scaffold (Turborepo + pnpm + shared configs)

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 10

**What was done**

- **Root toolchain**: `package.json` with `packageManager: pnpm@9.12.3`, scripts for dev/build/lint/typecheck/test/format, devDeps (turbo 2.9, typescript 5.9, eslint 9.39, prettier 3.8, husky 9.1, lint-staged 15.5, commitlint 19.8). `pnpm-workspace.yaml` covers `apps/*` + `packages/*`, excludes `apps/ai-service` (Python).
- **Turbo pipelines**: `turbo.json` with tasks `build / dev / lint / typecheck / test / test:integration / db:generate / db:migrate`. Proper `dependsOn ["^build"]` chain + cache rules per Playbook [IV.18.1.11].
- **Config files**: `.nvmrc` (Node 22), `.npmrc` (auto-install-peers, save-exact, engine-strict), `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.js` (conventional + `scope-case:[0]` to allow `(II.10.0)` style scopes).
- **Husky v9 hooks**: `.husky/pre-commit` → `pnpm exec lint-staged`, `.husky/commit-msg` → `pnpm exec commitlint --edit "$1"`. `.husky/_/` (auto-generated helpers) added to `.gitignore`. Husky's `prepare` script ran during install and wired `core.hooksPath=.husky/_`.
- **GitHub**: `.github/pull_request_template.md` enforcing prompt-id, acceptance criteria, verification output, CLAUDE.md checklist.
- **README.md**: quickstart + structure + commands + link to Playbook/prompts/CLAUDE.
- **Shared packages** (real, not placeholder):
  - `packages/tsconfig` — `base.json` (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess) + `nestjs.json` (decorators, CJS) + `nextjs.json` (jsx preserve, next plugin) + `react-native.json` (jsx react-native).
  - `packages/eslint-config` — flat config using `typescript-eslint` v8 + `globals`. Rules: `no-explicit-any: error`, `no-console` (allow warn/error), `no-unused-vars` (allow `_`-prefixed), `eqeqeq: always`.
- **Placeholder apps** (7 × 2 files): `api`, `web`, `admin`, `mobile`, `media-service`, `notification-worker`, `crawler-worker` — each with minimal `package.json` + `src/index.ts` noting which prompt will fill it.
- **Placeholder packages** (8 × 2 files): `@app/shared-types`, `@app/ui`, `@app/mobile-ui`, `@app/sdk`, `@app/logger`, `@app/config`, `@app/errors`, `@app/observability` — each with minimal `package.json` (type module, main/types pointing at src/index.ts) + placeholder `src/index.ts`.
- **Python sidecar**: `apps/ai-service/README.md` noting it's excluded from pnpm-workspace; real Python scaffold lands in `[IV.18.2.11]`.
- **CLAUDE.md updated**: commit-message format clarified to `<type>(<prompt-id>): <subject>` (conventional + scope=prompt-id) with valid types enumerated.

**Files created** — ~50 total:

- Root (12): `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.npmrc`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.js`, `README.md`, `.husky/pre-commit`, `.husky/commit-msg`.
- `.github/pull_request_template.md`
- `packages/tsconfig/` — `package.json`, `base.json`, `nestjs.json`, `nextjs.json`, `react-native.json` (5).
- `packages/eslint-config/` — `package.json`, `index.js` (2).
- Apps (15): `{api,web,admin,mobile,media-service,notification-worker,crawler-worker}/{package.json,src/index.ts}` + `ai-service/README.md`.
- Packages (16): `{shared-types,ui,mobile-ui,sdk,logger,config,errors,observability}/{package.json,src/index.ts}`.
- `pnpm-lock.yaml` (auto-generated by pnpm install).

**Files edited**

- `.gitignore` — added `.husky/_/`.
- `CLAUDE.md` — commit-message format rule updated to conventional commits.

**Dependencies added** (root devDeps):

- `turbo@^2.3.3` (resolved 2.9.6)
- `typescript@^5.7.2` (5.9.3)
- `eslint@^9.17.0` (9.39.4)
- `prettier@^3.4.2` (3.8.3)
- `husky@^9.1.7` (9.1.7)
- `lint-staged@^15.2.11` (15.5.2)
- `@commitlint/cli@^19.6.1` (19.8.1)
- `@commitlint/config-conventional@^19.6.0` (19.8.1)
- In `@app/eslint-config`: `typescript-eslint@^8.18.2`, `globals@^15.14.0`.
- Total 247 packages resolved in 18.2s.

**Commands run**

1. `corepack enable pnpm` — failed (admin required on Windows). Fallback: use `npx pnpm@9.12.3`.
2. `npx pnpm@9.12.3 install` — 247 packages, 18 workspace projects, husky prepare ran.
3. `npx pnpm turbo run typecheck lint` — 0 tasks matched (placeholders have no scripts yet), exit 0.
4. `echo "bad msg" | npx pnpm exec commitlint` — exit 1, rejected (✅ expected).
5. `echo "chore(II.10.0): ..." | npx pnpm exec commitlint` — exit 0, accepted (✅ expected).

**Verification**

- ✅ `pnpm install` succeeds (18.2s, 247 packages).
- ✅ `pnpm turbo run typecheck lint` green on empty placeholders (0 tasks, exit 0).
- ✅ Committing with a non-conventional message fails commitlint (2 errors: type-empty, subject-empty).
- ✅ Husky pre-commit is wired (`.husky/pre-commit` calls `lint-staged`; `core.hooksPath=.husky/_`).

**Acceptance criteria (from prompt)**

- ✅ `pnpm install` succeeds.
- ✅ `pnpm turbo run lint typecheck` green on empty placeholders.
- ✅ Committing with a non-conventional message fails commitlint.
- ✅ Husky pre-commit runs lint-staged.

**Notes / deviations**

- `corepack enable` needed admin on Windows; using `npx pnpm` as the invocation path. Documented in README quickstart. Future prompts: use `npx pnpm ...` or ask user to enable corepack once (admin prompt).
- Apps are placeholder-only — real NestJS/Next.js/Expo scaffolds land in `[III.11.x]` / `[IV.18.1.14.a-c]`.
- Packages `@app/ui`, `@app/mobile-ui`, `@app/sdk` are workspace-resolvable but export nothing yet.
- Did not add ESLint config or tsconfig.json per package placeholder — those land when each package gets its real code, keeping this scaffold prompt lean.

**Next prompt candidates**

- `[IV.17.6]` — wire `@app/*` path aliases in the shared tsconfig + root `tsconfig.json` (prereq for clean imports across packages).
- `[IV.18.1.7]` — testing infrastructure (Testcontainers + Jest + factories + MSW).
- `[IV.18.1.11]` — CI/CD GitHub Actions workflows.
- `[II.6.2]` / `[II.6.3]` / `[II.6.4]` — architecture ADRs.

---

### [IV.19.1] — Install System Rules + progress scaffolding

**Date:** 2026-04-18 · **Status:** DONE · **Kind:** Build · **Playbook §** 19.1

**What was done**

- Initialised the git repository on `main` (folder was not previously tracked).
- Added a root `.gitignore` covering Node/pnpm/Turbo, env files, editor, RN/Expo, Python, Prisma.
- Created `CLAUDE.md` at repo root with the full Part 0 System Rules from the prompt archive. This is auto-loaded by Claude Code and codifies the hard constraints, output format, self-check list, tool hints, and the per-prompt execution workflow this project is using.
- Created `docs/agent-contract.md` with the first acknowledgement entry so future seed prompts have a place to record agent agreements.
- Created this `PROGRESS.md` as the rolling execution log.

**Files created**

- `.gitignore`
- `CLAUDE.md`
- `docs/agent-contract.md`
- `PROGRESS.md`

**Files edited** — none.

**Dependencies added** — none (no code yet).

**Verification**

- `CLAUDE.md` exists at repo root with all 13 hard constraints.
- `docs/agent-contract.md` exists with the [IV.19.1] acknowledgement.
- `git status` clean after commit.

**Acceptance criteria (from prompt)**

- ✅ Claude Code reads the rules on every session start — CLAUDE.md present at repo root.
- ✅ `docs/agent-contract.md` collecting acknowledgements — created with first entry.

**Notes**

- No code artefacts yet — this is a docs/config prompt only, so no typecheck/lint/test retest was applicable.
- Next natural prompts to consider (pick one):
  - `[I.1.1]` — Context confirmation (seed, no code).
  - `[II.10.0]` — Monorepo scaffold (first real code; large).
  - `[IV.19.2]`/`[IV.19.3]`/`[IV.19.4]` — rest of the meta-layer (context-carry doc, end-prompt command, stop-hook).

**Commit** — see git log.
